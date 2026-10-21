/**
 * Server-only CAPTCHA solver.
 *
 * The PUC portal (`PucCertificate.xhtml`) gates every lookup behind a
 * `captcha.jpg` image. This module defines the solver seam plus a Meta AI
 * vision implementation (Muse Spark 1.3 Contributor by default).
 *
 * The model is called in JSON mode (`response_format: json_object`) with a
 * prompt that demands exactly `{"code": "...", "confidence": 0.0-1.0}` —
 * temperature 0 plus a strict schema keeps the output deterministic, and
 * the confidence score lets the workflow skip doomed submits and lets
 * callers audit how sure the model was.
 *
 * Configure via env (server only):
 * - `META_AI_API_KEY` (required for live solving)
 * - `META_AI_BASE_URL` (default `https://api.meta.ai/v1`, OpenAI-compatible)
 * - `META_AI_MODEL` (default `muse-spark-1.3-contributor`)
 *
 * The endpoint must speak the OpenAI chat-completions shape
 * (`POST {base}/chat/completions` with `messages[].content[].image_url`
 * and `response_format`). If your Meta AI gateway uses a different path,
 * point `META_AI_BASE_URL` at the gateway root that exposes
 * `/chat/completions`.
 *
 * Never import this module from client components — it reads secrets.
 */

import { z } from "zod";

export interface CaptchaSolution {
	/** Cleaned CAPTCHA code (alphanumerics only, max 12 chars). */
	code: string;
	/** Model-reported certainty the code is exactly right (0–1). */
	confidence: number;
	/** Raw model output before cleaning (audit trail). */
	raw: string;
}

export type CaptchaSolver = (
	image: Buffer | Uint8Array,
	opts?: { signal?: AbortSignal },
) => Promise<CaptchaSolution>;

export const META_AI_DEFAULT_MODEL = "muse-spark-1.3-contributor";
export const META_AI_DEFAULT_BASE_URL = "https://api.meta.ai/v1";

/** Below this confidence the workflow refreshes instead of submitting. */
export const MIN_CAPTCHA_CONFIDENCE = 0.5;

export const CAPTCHA_PROMPT =
	"This is a CAPTCHA security-code image from an Indian government portal. " +
	"Read the characters shown in the image. " +
	'Return ONLY a JSON object with exactly two keys: {"code": "<the characters, no spaces or punctuation>", "confidence": <your certainty from 0.0 to 1.0 that the code is exactly right>}. ' +
	"No markdown fences, no explanation, no extra keys.";

const captchaJsonSchema = z.object({
	code: z.string(),
	confidence: z.number().min(0).max(1),
});

function getMetaAiConfig(): {
	apiKey: string;
	baseUrl: string;
	model: string;
} {
	const apiKey = process.env.META_AI_API_KEY?.trim();
	if (!apiKey) {
		throw new Error(
			"META_AI_API_KEY is not configured on the server. Set it to solve PUC CAPTCHAs with Meta AI.",
		);
	}
	const baseUrl =
		process.env.META_AI_BASE_URL?.trim() || META_AI_DEFAULT_BASE_URL;
	const model = process.env.META_AI_MODEL?.trim() || META_AI_DEFAULT_MODEL;
	return { apiKey, baseUrl: baseUrl.replace(/\/+$/, ""), model };
}

/**
 * Strip solver chatter down to the raw code: first alphanumeric token,
 * whitespace/punctuation removed. PUC CAPTCHAs are short codes, so cap the
 * length defensively instead of trusting model output verbatim.
 */
export function cleanCaptchaText(raw: string): string {
	const compact = raw.replace(/[^a-zA-Z0-9]/g, "");
	return compact.slice(0, 12);
}

/**
 * Parse the model's JSON answer into a validated solution. Tolerates
 * markdown fences in case `response_format` is ever ignored; every other
 * shape error throws with the raw payload attached for debugging.
 */
export function parseCaptchaSolution(raw: string): CaptchaSolution {
	const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
	const jsonText = (fenced?.[1] ?? raw).trim();
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		throw new Error(
			`Meta AI CAPTCHA solve was not JSON: ${JSON.stringify(raw).slice(0, 200)}`,
		);
	}
	const result = captchaJsonSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(
			`Meta AI CAPTCHA solve missed the {code, confidence} schema: ${JSON.stringify(raw).slice(0, 200)}`,
		);
	}
	const code = cleanCaptchaText(result.data.code);
	if (!code) {
		throw new Error(
			`Meta AI returned an empty CAPTCHA code from raw: ${JSON.stringify(raw).slice(0, 200)}`,
		);
	}
	return { code, confidence: result.data.confidence, raw };
}

type ChatCompletionsResponse = {
	choices?: Array<{
		message?: { content?: string | Array<{ text?: string }> };
	}>;
};

/**
 * Solve a CAPTCHA PNG/JPEG via Meta AI vision chat completions in JSON mode.
 *
 * Sends the image as a base64 data URL and expects exactly
 * `{"code": "...", "confidence": 0-1}` back. Throws on missing key,
 * non-2xx, or unparseable answers.
 */
export function createMetaAiCaptchaSolver(
	overrides?: Partial<{ apiKey: string; baseUrl: string; model: string }>,
): CaptchaSolver {
	return async (image, opts) => {
		const fallback = (() => {
			try {
				return getMetaAiConfig();
			} catch {
				return {
					apiKey: "",
					baseUrl: META_AI_DEFAULT_BASE_URL,
					model: META_AI_DEFAULT_MODEL,
				};
			}
		})();
		const apiKey = overrides?.apiKey ?? fallback.apiKey;
		const baseUrl = (overrides?.baseUrl ?? fallback.baseUrl).replace(
			/\/+$/,
			"",
		);
		const model = overrides?.model ?? fallback.model;
		if (!apiKey) {
			throw new Error(
				"META_AI_API_KEY is not configured on the server. Set it to solve PUC CAPTCHAs with Meta AI.",
			);
		}
		const bytes = image instanceof Buffer ? image : Buffer.from(image);
		const dataUrl = `data:image/png;base64,${bytes.toString("base64")}`;

		const fetchInit: RequestInit = {
			body: JSON.stringify({
				// muse-spark is a reasoning model: it spends most of its
				// completion budget on reasoning_tokens, so a small budget
				// truncates before content (finish_reason "length", null
				// content). 1024 leaves room to reason AND answer; the
				// visible code is still capped to 12 chars by cleaning.
				max_tokens: 1024,
				messages: [
					{
						content: [
							{ text: CAPTCHA_PROMPT, type: "text" },
							{ image_url: { url: dataUrl }, type: "image_url" },
						],
						role: "user",
					},
				],
				model,
				response_format: { type: "json_object" },
				temperature: 0,
			}),
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			method: "POST",
		};
		if (opts?.signal) fetchInit.signal = opts.signal;
		const res = await fetch(`${baseUrl}/chat/completions`, fetchInit);

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(
				`Meta AI CAPTCHA solve failed (HTTP ${res.status}): ${body.slice(0, 300)}`,
			);
		}
		const json = (await res.json()) as ChatCompletionsResponse;
		const choice = json.choices?.[0]?.message?.content;
		const text = Array.isArray(choice)
			? choice.map((p) => p.text ?? "").join("")
			: (choice ?? "");
		if (!text) {
			throw new Error("Meta AI returned an empty CAPTCHA solution.");
		}
		return parseCaptchaSolution(text);
	};
}

/** Default solver wired to env. Throws at call time when unconfigured. */
export const solveCaptchaWithMetaAi: CaptchaSolver =
	createMetaAiCaptchaSolver();

/** Resolve the active solver (injectable for tests/CLI). */
export function getCaptchaSolver(override?: CaptchaSolver): CaptchaSolver {
	return override ?? solveCaptchaWithMetaAi;
}
