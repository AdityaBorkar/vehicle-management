/**
 * Shared CAPTCHA-gated form loop for browser workflows.
 *
 * PUCC and Vahan run the same algorithm with different selectors:
 * capture → solve → confidence-gate → submit → classify messages →
 * confirm result or retry. Portal specifics stay in the workflow via
 * callbacks; the retry bookkeeping, solver error handling, and
 * CAPTCHA-rejected / no-record classification live here exactly once.
 */

import type { CaptchaSolver } from "./captcha";
import { MIN_CAPTCHA_CONFIDENCE } from "./captcha";
import { isCaptchaFailure } from "./portal-messages";

export type CaptchaLoopWarn = (
	label: string,
	message: string,
	opts?: { attempt?: number | undefined; kind?: string | undefined },
) => void;

export interface CaptchaLoopOptions {
	/** Capture the current CAPTCHA image bytes. */
	captureImage: () => Promise<Buffer>;
	/** True when the submitted page confirms result content. */
	hasResult: (messages: string) => Promise<boolean>;
	/** True when the submitted page shows a terminal "no record" state. */
	isNoRecordMessage: (messages: string) => boolean;
	log: (...args: unknown[]) => void;
	maxAttempts: number;
	/** Read portal messages after submit. */
	readMessages: () => Promise<string>;
	/** Re-arm the form before retry N (refresh + re-fill / re-select). */
	refreshForRetry: (attempt: number) => Promise<void>;
	solver: CaptchaSolver;
	/** Fill the solved code and submit the form, settling the page. */
	submitCode: (code: string) => Promise<void>;
	warn: CaptchaLoopWarn;
}

export interface CaptchaLoopSuccess {
	attemptsUsed: number;
	confidence: number;
	messages: string;
}

/**
 * Run the CAPTCHA solve+submit loop. Resolves at the first submit that is
 * neither a CAPTCHA rejection nor a terminal no-record error *and* whose
 * `hasResult` check passes. A submit with no portal error but no result
 * content records a `no_certificate` warn and retries. Throws when the
 * portal reports no record, or when all attempts are exhausted.
 */
export async function runCaptchaLoop(
	opts: CaptchaLoopOptions,
): Promise<CaptchaLoopSuccess> {
	let lastError = "";
	for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
		if (attempt > 1) {
			opts.log(`refreshing CAPTCHA (attempt ${attempt}/${opts.maxAttempts})`);
			await opts.refreshForRetry(attempt);
		}
		let image: Buffer;
		try {
			image = await opts.captureImage();
		} catch (err) {
			lastError = `CAPTCHA image not found: ${err instanceof Error ? err.message : String(err)}`;
			opts.log(lastError);
			continue;
		}
		opts.log(
			`solving CAPTCHA (attempt ${attempt}/${opts.maxAttempts}, ${image.length} bytes)`,
		);
		let code: string;
		let confidence = 0;
		try {
			const solution = await opts.solver(image);
			code = solution.code;
			confidence = solution.confidence;
			opts.log(`CAPTCHA solved: code=${code} confidence=${confidence}`);
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
			opts.log(`CAPTCHA solver failed: ${lastError}`);
			opts.warn(`CAPTCHA solve attempt ${attempt}`, lastError, {
				attempt,
				kind: "captcha_solve",
			});
			continue;
		}
		if (!code) {
			lastError = "CAPTCHA solver returned an empty solution.";
			opts.warn(`CAPTCHA solve attempt ${attempt}`, lastError, {
				attempt,
				kind: "captcha_solve",
			});
			continue;
		}
		if (confidence < MIN_CAPTCHA_CONFIDENCE) {
			lastError = `CAPTCHA confidence ${confidence} below ${MIN_CAPTCHA_CONFIDENCE} — refreshing instead of submitting.`;
			opts.log(lastError);
			opts.warn(`CAPTCHA low confidence attempt ${attempt}`, lastError, {
				attempt,
				kind: "captcha_solve",
			});
			continue;
		}

		await opts.submitCode(code);

		const messages = await opts.readMessages();
		if (messages && isCaptchaFailure(messages)) {
			lastError = `CAPTCHA rejected by portal: ${messages.slice(0, 300)}`;
			opts.log(lastError);
			opts.warn(`CAPTCHA rejected attempt ${attempt}`, lastError, {
				attempt,
				kind: "captcha_rejected",
			});
			continue;
		}
		if (messages && opts.isNoRecordMessage(messages)) {
			throw new Error(messages.slice(0, 500));
		}
		if (await opts.hasResult(messages)) {
			return { attemptsUsed: attempt, confidence, messages };
		}
		lastError = messages
			? `Portal returned no result: ${messages.slice(0, 500)}`
			: "No result content detected after submit.";
		opts.log(lastError);
		if (attempt < opts.maxAttempts) {
			opts.warn(`Attempt ${attempt} produced no result`, lastError, {
				attempt,
				kind: "no_certificate",
			});
		}
	}
	throw new Error(
		`CAPTCHA failed after ${opts.maxAttempts} attempt(s). ${lastError}`.trim(),
	);
}
