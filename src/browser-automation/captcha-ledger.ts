/**
 * Server-only CAPTCHA LLM ledger writer (Spec 02 §4.3).
 *
 * Split out of `engine.ts` to avoid import cycles: the engine's per-run
 * solver wrapper calls `recordLlmRequest()` after each Meta AI call.
 * Never writes secrets (API key, signature) — only redacted params.
 */

import { desc, eq } from "drizzle-orm";

import { llmRequests } from "#/db-schema";
import { db } from "#/lib/db";
import { getArtifactStore } from "./artifact-store";
import {
	CAPTCHA_PROMPT,
	META_AI_DEFAULT_BASE_URL,
	META_AI_DEFAULT_MODEL,
} from "./captcha";

function truncate(value: string, max: number): string {
	return value.length > max ? value.slice(0, max) : value;
}

export async function recordLlmRequest(input: {
	error?: string | undefined;
	image: Buffer | Uint8Array;
	latencyMs?: number | undefined;
	parsedCode?: string | null | undefined;
	parsedConfidence?: number | null | undefined;
	rawText?: string | undefined;
	runId: number;
	status: string;
	userId: string;
}): Promise<void> {
	try {
		const bytes = Buffer.isBuffer(input.image)
			? input.image
			: Buffer.from(input.image);
		let imageKey: string | null = null;
		try {
			const stamp = new Date().toISOString().replace(/[:.]/g, "-");
			const saved = await getArtifactStore().save(
				`debug/${input.runId}/captcha-${stamp}.png`,
				bytes,
				{ contentType: "image/png" },
			);
			imageKey = saved.relativePath;
		} catch (err) {
			console.error("[captcha-ledger] image upload failed:", err);
		}
		const baseUrl =
			process.env.META_AI_BASE_URL?.trim() || META_AI_DEFAULT_BASE_URL;
		const model = process.env.META_AI_MODEL?.trim() || META_AI_DEFAULT_MODEL;
		await db.insert(llmRequests).values({
			confidence: input.parsedConfidence ?? null,
			error: input.error ? truncate(input.error, 2000) : null,
			imageKey,
			latencyMs: input.latencyMs ?? null,
			model,
			parsedCode: input.parsedCode ?? null,
			prompt: CAPTCHA_PROMPT,
			provider: "meta-ai",
			purpose: "captcha-solve",
			request: {
				baseUrl,
				max_tokens: 1024,
				model,
				response_format: "json_object",
				temperature: 0,
			},
			response: input.rawText ? { raw: truncate(input.rawText, 8000) } : null,
			runId: input.runId,
			status: input.status,
			userId: input.userId,
		});
	} catch (err) {
		console.error("[captcha-ledger] recordLlmRequest failed:", err);
	}
}

/**
 * Mark the latest CAPTCHA solve for a run as portal-rejected.
 * The solver itself succeeded (valid JSON), but the portal judged the code
 * wrong — the ledger must show `rejected`, not `success`, for the audit trail.
 * Best-effort: never throws.
 */
export async function markLatestLlmRejected(input: {
	message: string;
	runId: number;
	userId: string;
}): Promise<void> {
	try {
		const [latest] = await db
			.select({ id: llmRequests.id })
			.from(llmRequests)
			.where(eq(llmRequests.runId, input.runId))
			.orderBy(desc(llmRequests.id))
			.limit(1);
		if (!latest) return;
		await db
			.update(llmRequests)
			.set({
				error: truncate(input.message, 2000),
				status: "rejected",
			})
			.where(eq(llmRequests.id, latest.id));
	} catch (err) {
		console.error("[captcha-ledger] markLatestLlmRejected failed:", err);
	}
}
