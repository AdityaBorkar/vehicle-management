/**
 * Vahan "Know Your Application Status" / Transaction History workflow.
 *
 * Flow: Vahan login → Status → Know Your Application Status →
 * Vehicle Number radio → registration number → CAPTCHA → Submit →
 * extract + store the per-vehicle snapshot.
 *
 * Search-mode form handling lives in `./vahan-form`, table extraction in
 * `./vahan-extract`, and the CAPTCHA retry loop in `../captcha-flow` (shared
 * with PUCC). This module owns orchestration, persistence, and the workflow
 * definition only.
 */

import { and, eq } from "drizzle-orm";
import type { Page } from "patchright";
import { z } from "zod";

import { vehicles, vehicleTransactions } from "#/db-schema";
import { db } from "#/lib/db";
import { normalizeRegistrationNumber } from "#/lib/vehicle-registration";
import type { ArtifactStore } from "../artifact-store";
import type { CaptchaSolver } from "../captcha";
import { solveCaptchaWithMetaAi } from "../captcha";
import { runCaptchaLoop } from "../captcha-flow";
import type { WorkflowDefinition } from "../engine";
import { parseWorkflowInput, registerWorkflow } from "../engine";
import { browserAutomation } from "../index";
import { attachConsoleCapture, finalizeConsoleLog } from "../observability";
import { isNoRecordFailure, readPortalMessages } from "../portal-messages";
import type { VahanTransactionRecord } from "./vahan-extract";
import {
	extractSummaryPairs,
	extractTransactionRows,
	hasResultContent,
	toTransactionRecord,
} from "./vahan-extract";
import { fillVehicleNumber, selectVehicleNumberOption } from "./vahan-form";
import { vahanLogin } from "./vahan-login";

export type { VahanTransactionRecord } from "./vahan-extract";
export { parseTxDate, toTransactionRecord } from "./vahan-extract";
export {
	assertVehicleMode,
	classifyField,
	fillVehicleNumber,
	isApplicationNumberDescriptor,
	isCaptchaLikeDescriptor,
	isVehicleNumberDescriptor,
	selectVehicleNumberOption,
} from "./vahan-form";
// Re-exported for existing tests and callers importing from this module.
export { normalizeRegistrationNumber };

export const vahanTransactionHistoryInputSchema = z.object({
	maxCaptchaAttempts: z.number().int().min(1).max(10).optional(),
	registrationNumber: z
		.string()
		.min(1)
		.max(20)
		.refine(
			(v) => {
				try {
					normalizeRegistrationNumber(v);
					return true;
				} catch {
					return false;
				}
			},
			{
				message:
					'Invalid registration number. Expected format like "MH01CR7464".',
			},
		),
	timeoutMs: z.number().int().positive().optional(),
	vehicleId: z.number().int(),
});

export const VAHAN_TRANSACTION_HISTORY_WORKFLOW_NAME =
	"vahan-transaction-history" as const;

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_CAPTCHA_ATTEMPTS = 5;

export interface VahanTransactionHistoryInput {
	maxCaptchaAttempts?: number | undefined;
	registrationNumber: string;
	timeoutMs?: number | undefined;
	vehicleId?: number | null | undefined;
}

export interface VahanTransactionHistoryOutput {
	details: Record<string, string>;
	fetchedAt: string;
	registrationNumber: string;
	transactions: VahanTransactionRecord[];
}

async function clickFirstVisible(
	page: Page,
	selectors: string[],
	timeoutMs: number,
	label: string,
): Promise<void> {
	const errors: string[] = [];
	for (const selector of selectors) {
		const locator = page.locator(selector).first();
		try {
			await locator.waitFor({ state: "visible", timeout: 6000 });
			await locator.click({ timeout: timeoutMs });
			await page
				.waitForLoadState("networkidle", { timeout: timeoutMs })
				.catch(() => {});
			await page.waitForTimeout(1200);
			return;
		} catch (err) {
			errors.push(
				`${selector}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
	throw new Error(
		`Could not open "${label}". Tried: ${errors.join(" | ").slice(0, 600)}`,
	);
}

async function openApplicationStatusPage(
	page: Page,
	timeoutMs: number,
): Promise<void> {
	await clickFirstVisible(
		page,
		[
			"a:has-text('Status')",
			"span:has-text('Status')",
			"li:has-text('Status')",
			"[id*='status' i]",
		],
		timeoutMs,
		"Status menu",
	);
	await clickFirstVisible(
		page,
		[
			"a:has-text('Know Your Application Status')",
			"a:has-text('Know your Application Status')",
			"a:has-text('Application Status')",
			"span:has-text('Application Status')",
			"a:has-text('Know Application Status')",
		],
		timeoutMs,
		"Know Your Application Status",
	);
}

async function captureCaptcha(page: Page, timeoutMs: number) {
	const img = page.locator(
		"img[id*='captcha' i], img[src*='captcha' i], canvas[id*='captcha' i]",
	);
	await img.first().waitFor({ state: "visible", timeout: timeoutMs });
	const bytes = await img.first().screenshot({ timeout: timeoutMs });
	return { bytes: Buffer.from(bytes), img: img.first() };
}

async function fillCaptchaAndSubmit(
	page: Page,
	code: string,
	timeoutMs: number,
): Promise<void> {
	const input = page.locator(
		"input[id*='captcha' i], input[id*='security' i], input[name*='captcha' i]",
	);
	await input.first().waitFor({ state: "visible", timeout: timeoutMs });
	await input.first().fill(code, { timeout: timeoutMs });

	const submit = page.locator(
		"button:has-text('Submit'), input[type='submit'], button:has-text('Show'), button:has-text('Get Details'), button:has-text('Search')",
	);
	await submit.first().waitFor({ state: "visible", timeout: timeoutMs });
	await submit.first().click({ timeout: timeoutMs });
	await page
		.waitForLoadState("networkidle", { timeout: timeoutMs })
		.catch(() => {});
	await page.waitForTimeout(2500);
}

async function refreshCaptchaImage(page: Page): Promise<void> {
	const refresh = page.locator(
		"a:has(img[src*='captcha' i]), button:has(img[src*='captcha' i]), a:has-text('Refresh'), button:has-text('Refresh')",
	);
	try {
		if ((await refresh.count()) > 0) {
			await refresh.first().click({ timeout: 8000 });
			await page.waitForTimeout(1500);
			return;
		}
	} catch {
		// Fall through to reload.
	}
	await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
}

export async function runTransactionHistoryWithPage(
	page: Page,
	input: VahanTransactionHistoryInput,
	deps?: Partial<{
		artifactStore: ArtifactStore;
		captchaSolver: CaptchaSolver;
		events?:
			| {
					warn: (
						label: string,
						message: string,
						opts?: { attempt?: number | undefined; kind?: string | undefined },
					) => void;
			  }
			| undefined;
		log: (...args: unknown[]) => void;
		runId: number;
		userId?: string | undefined;
	}>,
): Promise<VahanTransactionHistoryOutput> {
	const registrationNumber = normalizeRegistrationNumber(
		input.registrationNumber,
	);
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxAttempts = input.maxCaptchaAttempts ?? DEFAULT_MAX_CAPTCHA_ATTEMPTS;
	const solver = deps?.captchaSolver ?? solveCaptchaWithMetaAi;
	const log =
		deps?.log ?? ((...args: unknown[]) => console.log("[vahan-tx]", ...args));
	const warn =
		deps?.events?.warn ??
		((label: string, message: string) => log(`WARN ${label}: ${message}`));

	await vahanLogin(page, { registrationNumber, timeoutMs });
	await openApplicationStatusPage(page, timeoutMs);
	await selectVehicleNumberOption(page, timeoutMs, log);
	await fillVehicleNumber(page, registrationNumber, timeoutMs, log);

	// CAPTCHA solve + submit with retries; no-record aborts immediately.
	// The result tables are scraped inside `hasResult` so the loop can
	// retry when a submit yields neither an error nor content.
	let latest: {
		details: Record<string, string>;
		rows: Record<string, string>[];
	} = {
		details: {},
		rows: [],
	};
	try {
		await runCaptchaLoop({
			captureImage: async () => (await captureCaptcha(page, timeoutMs)).bytes,
			hasResult: async () => {
				const [details, rows] = await Promise.all([
					extractSummaryPairs(page),
					extractTransactionRows(page),
				]);
				const bodyText = await page
					.evaluate(() => document.body?.innerText ?? "")
					.catch(() => "");
				if (!hasResultContent(details, rows, bodyText, registrationNumber)) {
					return false;
				}
				latest = { details, rows };
				return true;
			},
			isNoRecordMessage: isNoRecordFailure,
			log,
			maxAttempts,
			readMessages: () => readPortalMessages(page),
			refreshForRetry: async () => {
				await refreshCaptchaImage(page);
				try {
					// A refresh/reload resets the search-mode radio to its
					// default (Application Number), so re-select before re-fill.
					await selectVehicleNumberOption(page, timeoutMs, log);
					await fillVehicleNumber(page, registrationNumber, timeoutMs, log);
				} catch {
					// Form may still hold the value after refresh.
				}
			},
			solver,
			submitCode: (code) => fillCaptchaAndSubmit(page, code, timeoutMs),
			warn,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (isNoRecordFailure(message)) {
			throw new Error(
				`No transactions found for "${registrationNumber}": ${message.slice(0, 500)}`,
			);
		}
		throw new Error(
			`Application-status CAPTCHA failed after ${maxAttempts} attempt(s). ${message}`.trim(),
		);
	}

	const transactions = latest.rows
		.map((r) => toTransactionRecord(r))
		.filter((r): r is VahanTransactionRecord => r !== null);
	return {
		details: latest.details,
		fetchedAt: new Date().toISOString(),
		registrationNumber,
		transactions:
			transactions.length > 0
				? transactions
				: latest.details && Object.keys(latest.details).length > 0
					? [
							{
								applicationNumber: null,
								raw: latest.details,
								remarks: null,
								serviceType: null,
								status: null,
								transactionDate: null,
							},
						]
					: [],
	};
}

/**
 * Direct (non-queued) fetch: owns its page lifecycle. Used by the CLI and
 * by the engine definition below.
 */
export async function fetchTransactionHistoryDirect(
	input: VahanTransactionHistoryInput,
	deps?: Partial<{
		artifactStore: ArtifactStore;
		captchaSolver: CaptchaSolver;
		events?:
			| {
					warn: (
						label: string,
						message: string,
						opts?: { attempt?: number | undefined; kind?: string | undefined },
					) => void;
			  }
			| undefined;
		headless?: boolean;
		log: (...args: unknown[]) => void;
		runId: number;
		userId?: string | undefined;
	}>,
): Promise<VahanTransactionHistoryOutput> {
	const page = await browserAutomation.newPage();
	const capture =
		deps?.runId && deps?.userId
			? attachConsoleCapture(page, deps.runId, deps.userId)
			: null;
	try {
		return await runTransactionHistoryWithPage(page, input, deps);
	} finally {
		capture?.detach();
		if (capture && deps?.runId && deps?.userId) {
			await finalizeConsoleLog(deps.runId, deps.userId, capture.lines);
		}
		await page.close().catch(() => {});
	}
}

function toDbDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

/** Replace the stored snapshot for a vehicle with a fresh fetch. */
export async function storeTransactionHistory(
	userId: string,
	vehicleId: number,
	output: VahanTransactionHistoryOutput,
): Promise<void> {
	await db
		.delete(vehicleTransactions)
		.where(
			and(
				eq(vehicleTransactions.userId, userId),
				eq(vehicleTransactions.vehicleId, vehicleId),
			),
		);
	const rows = output.transactions.map((t) => ({
		applicationNumber: t.applicationNumber ?? null,
		fetchedAt: new Date(output.fetchedAt),
		raw: t.raw,
		registrationNumber: output.registrationNumber,
		remarks: t.remarks ?? null,
		serviceType: t.serviceType ?? null,
		status: t.status ?? null,
		transactionDate: toDbDate(t.transactionDate),
		userId,
		vehicleId,
	}));
	if (rows.length === 0) {
		await db.insert(vehicleTransactions).values({
			fetchedAt: new Date(output.fetchedAt),
			raw: output.details,
			registrationNumber: output.registrationNumber,
			userId,
			vehicleId,
		});
		return;
	}
	await db.insert(vehicleTransactions).values(rows);
}

export const vahanTransactionHistoryWorkflowDefinition: WorkflowDefinition = {
	inputSchema: vahanTransactionHistoryInputSchema,
	meta: {
		description:
			"Enqueues a background run: Vahan login → Status → Know Your Application Status → Vehicle Number → CAPTCHA → Submit → store.",
		displayName: "Transaction History (async)",
		fields: [
			{
				help: "e.g. MH01CR7464",
				label: "Registration number",
				name: "registrationNumber",
				placeholder: "MH01CR7464",
				required: true,
				type: "registrationNumber",
				validate: (v: string) => {
					try {
						normalizeRegistrationNumber(v);
						return null;
					} catch (err) {
						return err instanceof Error
							? err.message
							: "Invalid registration number.";
					}
				},
			},
			{
				help: "Vehicle record to attach the snapshot to",
				label: "Vehicle ID",
				name: "vehicleId",
				placeholder: "1",
				required: true,
				type: "vehicleId",
				validate: (v: string) => {
					if (!v.trim()) return "Vehicle ID is required.";
					return /^\d+$/.test(v.trim()) ? null : "Enter a numeric vehicle ID.";
				},
			},
		],
	},
	name: VAHAN_TRANSACTION_HISTORY_WORKFLOW_NAME,
	run: async (ctx) => {
		const parsed = parseWorkflowInput<
			z.infer<typeof vahanTransactionHistoryInputSchema>
		>(vahanTransactionHistoryInputSchema, ctx.input);
		const output = await fetchTransactionHistoryDirect(
			{
				registrationNumber: parsed.registrationNumber,
				...(parsed.maxCaptchaAttempts !== undefined
					? { maxCaptchaAttempts: parsed.maxCaptchaAttempts }
					: {}),
				vehicleId: parsed.vehicleId,
			},
			{
				artifactStore: ctx.artifactStore,
				captchaSolver: ctx.captchaSolver,
				events: ctx.events,
				log: ctx.log,
				runId: ctx.runId,
				userId: ctx.userId,
			},
		);
		const [vehicle] = await db
			.select({ id: vehicles.id })
			.from(vehicles)
			.where(
				and(eq(vehicles.id, parsed.vehicleId), eq(vehicles.userId, ctx.userId)),
			);
		if (vehicle) {
			await storeTransactionHistory(ctx.userId, vehicle.id, output);
		} else {
			ctx.log(`vehicle #${parsed.vehicleId} not found — skipping DB snapshot`);
		}
		return { output: { ...output } };
	},
};

registerWorkflow(vahanTransactionHistoryWorkflowDefinition);
