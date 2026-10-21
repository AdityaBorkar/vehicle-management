/**
 * PUCC fetch workflow (Parivahan PUC portal).
 *
 * Flow (per requirements):
 * 1. Navigate to https://puc.parivahan.gov.in/puc/views/PucCertificate.xhtml
 * 2. Enter registration number (`#regnNumber`, max 10) + chassis last-5
 *    (`#chessiNo`, max 5)
 * 3. Solve the `#imgCaptchaId` CAPTCHA with Meta AI vision
 *    (`muse-spark-1.3-contributor` by default, see `../captcha.ts`)
 * 4. Click "PUC Details" (`#showDetails`)
 * 5. On success click the certificate "Print" button and save the
 *    resulting print view (popup when one opens, else the current page)
 *    as PDF via the artifact store (server FS for now, S3 later).
 *
 * CAPTCHA is retried up to `maxCaptchaAttempts` (default 5): each failure
 * refreshes the image and solves again. Non-CAPTCHA failures (unknown
 * vehicle, invalid chassis) abort immediately so we don't burn AI calls.
 */

import type { Page } from "patchright";

import { formatVin } from "#/lib/utils";
import type { ArtifactStore } from "../artifact-store";
import { artifactStore } from "../artifact-store";
import type { CaptchaSolver } from "../captcha";
import { MIN_CAPTCHA_CONFIDENCE, solveCaptchaWithMetaAi } from "../captcha";
import type { WorkflowDefinition } from "../engine";
import { registerWorkflow } from "../engine";
import { browserAutomation } from "../index";

export const PUCC_WORKFLOW_NAME = "pucc-fetch" as const;

export const PUCC_URL =
	"https://puc.parivahan.gov.in/puc/views/PucCertificate.xhtml";

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_CAPTCHA_ATTEMPTS = 5;

export interface PuccWorkflowInput {
	chassisLast5: string;
	maxCaptchaAttempts?: number | undefined;
	registrationNumber: string;
	timeoutMs?: number | undefined;
	vehicleId?: number | null | undefined;
}

export interface PuccWorkflowOutput {
	artifactPath: string;
	artifactRelativePath: string;
	attemptsUsed: number;
	/** Model-reported confidence of the accepted CAPTCHA solve (0–1). */
	captchaConfidence: number;
	fetchedAt: string;
	/** True when the PDF came from the portal's Print button view. */
	printButtonUsed: boolean;
	registrationNumber: string;
}

export function normalizePuccRegistrationNumber(value: string): string {
	const formatted = formatVin(value);
	if (!/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(formatted)) {
		throw new Error(
			`Invalid registration number: "${value}". Expected format like "MH01CR7464".`,
		);
	}
	if (formatted.length > 10) {
		throw new Error(
			`Invalid registration number: "${formatted}" exceeds 10 characters (PUC portal limit).`,
		);
	}
	return formatted;
}

export function normalizeChassisLast5(value: string): string {
	const formatted = value.toUpperCase().replace(/[\s-]+/g, "");
	if (!/^[A-Z0-9]{5}$/.test(formatted)) {
		throw new Error(
			`Invalid chassis suffix: "${value}". Enter exactly the last 5 characters of the chassis number (A-Z, 0-9).`,
		);
	}
	return formatted;
}

async function fillPuccForm(
	page: Page,
	reg: string,
	chassisLast5: string,
	timeoutMs: number,
): Promise<void> {
	const regInput = page.locator("#regnNumber");
	await regInput.waitFor({ state: "visible", timeout: timeoutMs });
	await regInput.fill(reg, { timeout: timeoutMs });

	const chassisInput = page.locator("#chessiNo");
	await chassisInput.waitFor({ state: "visible", timeout: timeoutMs });
	await chassisInput.fill(chassisLast5, { timeout: timeoutMs });
}

async function captureCaptchaImage(
	page: Page,
	timeoutMs: number,
): Promise<Buffer> {
	const img = page.locator("#imgCaptchaId");
	await img.waitFor({ state: "visible", timeout: timeoutMs });
	const bytes = await img.screenshot({ timeout: timeoutMs });
	return Buffer.from(bytes);
}

async function refreshCaptcha(page: Page): Promise<void> {
	// Refresh anchor wraps `cap.png` (`#j_idt98`) and rewrites
	// `#imgCaptchaId` src with a random query string.
	const refresh = page.locator("a:has(img[src*='cap.png']), a:has(#j_idt98)");
	try {
		if ((await refresh.count()) > 0) {
			const before = await page
				.locator("#imgCaptchaId")
				.getAttribute("src")
				.catch(() => null);
			await refresh.first().click({ timeout: 8000 });
			try {
				await page.waitForFunction(
					(prev) => {
						const el =
							document.querySelector<HTMLImageElement>("#imgCaptchaId");
						return el && el.getAttribute("src") !== prev;
					},
					before,
					{ timeout: 8000 },
				);
			} catch {
				await page.waitForTimeout(1500);
			}
			return;
		}
	} catch {
		// Fall through to plain reload of the image element.
	}
	await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
}

async function readPortalMessages(page: Page): Promise<string> {
	return page
		.evaluate(() => {
			const parts: string[] = [];
			const push = (el: Element | null) => {
				if (el?.textContent?.trim()) parts.push(el.textContent.trim());
			};
			push(document.querySelector("#messages"));
			document
				.querySelectorAll(
					".ui-messages-error, .ui-message-error, .ui-growl-message, .error",
				)
				.forEach((el) => {
					push(el);
				});
			return parts.join("\n").replace(/\s+/g, " ").trim();
		})
		.catch(() => "");
}

function isCaptchaFailure(text: string): boolean {
	return /captch|security code|invalid.*code|incorrect|mismatch|wrong|try again|expired/i.test(
		text,
	);
}

function isNoRecordFailure(text: string): boolean {
	return /no record|not found|no data|invalid.*(vehicle|registration|chassis)|mismatch.*chassis/i.test(
		text,
	);
}

async function hasCertificateContent(
	page: Page,
	registrationNumber: string,
): Promise<boolean> {
	const bodyText = await page
		.evaluate(() => document.body?.innerText ?? "")
		.catch(() => "");
	if (!bodyText) return false;
	const hasReg = bodyText
		.toUpperCase()
		.includes(registrationNumber.toUpperCase());
	const hasCertMarker =
		/Certificate No|PUCC No|PUC No|Pollution.*Certificate|PUC Certificate|valid (upto|till|up to)/i.test(
			bodyText,
		);
	if (hasReg && hasCertMarker) return true;
	// Fallback: explicit print/download affordance next to certificate text.
	try {
		const printBtn = page.locator(
			"a:has-text('Print'), button:has-text('Print'), a:has-text('Download'), button:has-text('Download')",
		);
		if ((await printBtn.count()) > 0 && hasCertMarker) return true;
	} catch {
		// ignore — text heuristic above is authoritative.
	}
	return false;
}

async function submitAndSettle(page: Page, timeoutMs: number): Promise<void> {
	const submit = page.locator("#showDetails");
	await submit.waitFor({ state: "visible", timeout: timeoutMs });
	await submit.click({ timeout: timeoutMs });
	// JSF does a full form POST; settle on network idle, then give
	// PrimeFaces a beat to render messages/certificate.
	await page
		.waitForLoadState("networkidle", { timeout: timeoutMs })
		.catch(() => {});
	await page.waitForTimeout(2500);
}

async function savePageAsPdf(page: Page): Promise<Buffer> {
	// `page.pdf()` only works in headless Chromium; CDP `Page.printToPDF`
	// works in both headed and headless, so prefer it.
	try {
		const session = await page.context().newCDPSession(page);
		try {
			const { data } = (await session.send("Page.printToPDF", {
				displayHeaderFooter: false,
				preferCSSPageSize: true,
				printBackground: true,
			})) as { data: string };
			if (data) return Buffer.from(data, "base64");
		} finally {
			await session.detach().catch(() => {});
		}
	} catch (err) {
		console.warn(
			`[pucc] CDP printToPDF failed, falling back to page.pdf:`,
			err,
		);
	}
	const pdf = await page.pdf({
		format: "A4",
		printBackground: true,
	});
	return Buffer.from(pdf);
}

const PRINT_BUTTON_SELECTORS = [
	"button:has-text('Print')",
	"a:has-text('Print')",
	"input[type='submit'][value='Print' i]",
	"input[type='button'][value='Print' i]",
];

async function stubWindowPrint(page: Page): Promise<void> {
	await page
		.evaluate(() => {
			window.print = () => {};
		})
		.catch(() => {});
}

/**
 * Click the certificate "Print" button and capture its print view.
 *
 * Returns the popup page when the button opens one, otherwise null — the
 * caller then prints the current page (same-tab navigation and in-place
 * print-CSS swaps are both covered by that fallback). `window.print` is
 * stubbed first so a native print dialog can never block headed runs.
 */
async function clickPrintForPopup(
	page: Page,
	timeoutMs: number,
	log: (...args: unknown[]) => void,
): Promise<Page | null> {
	for (const selector of PRINT_BUTTON_SELECTORS) {
		const button = page.locator(selector).first();
		try {
			await button.waitFor({ state: "visible", timeout: 8000 });
		} catch {
			continue;
		}
		log(`clicking Print button (${selector})`);
		await stubWindowPrint(page);
		const popupPromise = page
			.context()
			.waitForEvent("page", { timeout: 6000 })
			.catch(() => null);
		try {
			await button.click({ timeout: timeoutMs });
		} catch (err) {
			log(
				`Print button click failed: ${err instanceof Error ? err.message : err}`,
			);
			await popupPromise;
			continue;
		}
		const popup = await popupPromise;
		if (popup) {
			try {
				await popup.waitForLoadState("domcontentloaded", {
					timeout: timeoutMs,
				});
			} catch {
				// Still usable — fall through to the settle wait.
			}
			await stubWindowPrint(popup);
			await popup.waitForTimeout(1500);
			return popup;
		}
		log("Print button opened no popup — printing current page");
		return null;
	}
	log("no Print button found — printing current page");
	return null;
}

export async function runPuccWithPage(
	page: Page,
	input: PuccWorkflowInput,
	deps?: Partial<{
		artifactStore: ArtifactStore;
		captchaSolver: CaptchaSolver;
		log: (...args: unknown[]) => void;
		runId: number;
	}>,
): Promise<PuccWorkflowOutput> {
	const registrationNumber = normalizePuccRegistrationNumber(
		input.registrationNumber,
	);
	const chassisLast5 = normalizeChassisLast5(input.chassisLast5);
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxAttempts = input.maxCaptchaAttempts ?? DEFAULT_MAX_CAPTCHA_ATTEMPTS;
	const solver = deps?.captchaSolver ?? solveCaptchaWithMetaAi;
	const store = deps?.artifactStore ?? artifactStore;
	const log =
		deps?.log ?? ((...args: unknown[]) => console.log("[pucc]", ...args));

	await page.goto(PUCC_URL, {
		timeout: timeoutMs,
		waitUntil: "domcontentloaded",
	});
	await page
		.locator("#regnNumber")
		.waitFor({ state: "visible", timeout: timeoutMs });
	await fillPuccForm(page, registrationNumber, chassisLast5, timeoutMs);

	let lastError = "";
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		if (attempt > 1) {
			log(`refreshing CAPTCHA (attempt ${attempt}/${maxAttempts})`);
			await refreshCaptcha(page);
			// Re-fill: a refresh/reload can clear the form.
			try {
				await fillPuccForm(page, registrationNumber, chassisLast5, timeoutMs);
			} catch {
				// Form may already hold values — continue to solve.
			}
		}
		const image = await captureCaptchaImage(page, timeoutMs);
		log(
			`solving CAPTCHA (attempt ${attempt}/${maxAttempts}, ${image.length} bytes)`,
		);
		let code: string;
		let confidence = 0;
		try {
			const solution = await solver(image);
			code = solution.code;
			confidence = solution.confidence;
			log(`CAPTCHA solved: code=${code} confidence=${confidence}`);
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
			log(`CAPTCHA solver failed: ${lastError}`);
			continue;
		}
		if (!code) {
			lastError = "CAPTCHA solver returned an empty solution.";
			continue;
		}
		if (confidence < MIN_CAPTCHA_CONFIDENCE) {
			lastError = `CAPTCHA confidence ${confidence} below ${MIN_CAPTCHA_CONFIDENCE} — refreshing instead of submitting.`;
			log(lastError);
			continue;
		}
		const captchaInput = page.locator("#txtCaptchaId");
		await captchaInput.waitFor({ state: "visible", timeout: timeoutMs });
		await captchaInput.fill(code, { timeout: timeoutMs });

		await submitAndSettle(page, timeoutMs);

		const messages = await readPortalMessages(page);
		if (messages && isCaptchaFailure(messages)) {
			lastError = `CAPTCHA rejected by portal: ${messages.slice(0, 300)}`;
			log(lastError);
			continue;
		}
		if (messages && isNoRecordFailure(messages)) {
			throw new Error(`PUC lookup failed: ${messages.slice(0, 500)}`);
		}
		if (await hasCertificateContent(page, registrationNumber)) {
			const printPage = await clickPrintForPopup(page, timeoutMs, log);
			const pdf = await savePageAsPdf(printPage ?? page);
			await printPage?.close().catch(() => {});
			const stamp = new Date().toISOString().replace(/[:.]/g, "-");
			const runSegment = deps?.runId ? `run-${deps.runId}` : "adhoc";
			const saved = await store.save(
				`pucc/${registrationNumber}/${stamp}-${runSegment}-pucc.pdf`,
				pdf,
			);
			return {
				artifactPath: saved.absolutePath,
				artifactRelativePath: saved.relativePath,
				attemptsUsed: attempt,
				captchaConfidence: confidence,
				fetchedAt: new Date().toISOString(),
				printButtonUsed: printPage !== null,
				registrationNumber,
			};
		}
		// No certificate yet and no explicit error — treat as CAPTCHA miss
		// when the form is still present, otherwise surface portal text.
		const formStillThere = (await page.locator("#showDetails").count()) > 0;
		lastError = messages
			? `PUC lookup failed: ${messages.slice(0, 500)}`
			: "PUC certificate not detected after submit.";
		log(lastError);
		if (!formStillThere && !messages) {
			// Result page rendered *something* without our markers — still
			// save the PDF so the run is auditable instead of failing blind.
			const printPage = await clickPrintForPopup(page, timeoutMs, log);
			const pdf = await savePageAsPdf(printPage ?? page);
			await printPage?.close().catch(() => {});
			const stamp = new Date().toISOString().replace(/[:.]/g, "-");
			const runSegment = deps?.runId ? `run-${deps.runId}` : "adhoc";
			const saved = await store.save(
				`pucc/${registrationNumber}/${stamp}-${runSegment}-pucc-unverified.pdf`,
				pdf,
			);
			return {
				artifactPath: saved.absolutePath,
				artifactRelativePath: saved.relativePath,
				attemptsUsed: attempt,
				captchaConfidence: confidence,
				fetchedAt: new Date().toISOString(),
				printButtonUsed: printPage !== null,
				registrationNumber,
			};
		}
	}

	throw new Error(
		`PUC CAPTCHA failed after ${maxAttempts} attempt(s). ${lastError}`.trim(),
	);
}

/**
 * Direct (non-queued) fetch: owns its page lifecycle. Used by the CLI and
 * by the engine definition below.
 */
export async function fetchPuccCertificateDirect(
	input: PuccWorkflowInput,
	deps?: Partial<{
		artifactStore: ArtifactStore;
		captchaSolver: CaptchaSolver;
		headless?: boolean;
		log: (...args: unknown[]) => void;
		runId: number;
	}>,
): Promise<PuccWorkflowOutput> {
	const page = await browserAutomation.newPage();
	try {
		return await runPuccWithPage(page, input, deps);
	} finally {
		await page.close().catch(() => {});
	}
}

export const puccWorkflowDefinition: WorkflowDefinition = {
	name: PUCC_WORKFLOW_NAME,
	run: async (ctx) => {
		const raw = ctx.input as Record<string, unknown>;
		const maxAttempts =
			typeof raw["maxCaptchaAttempts"] === "number"
				? (raw["maxCaptchaAttempts"] as number)
				: undefined;
		const vehicleId =
			typeof raw["vehicleId"] === "number"
				? (raw["vehicleId"] as number)
				: null;
		const output = await fetchPuccCertificateDirect(
			{
				chassisLast5: String(raw["chassisLast5"] ?? ""),
				registrationNumber: String(raw["registrationNumber"] ?? ""),
				...(maxAttempts !== undefined
					? { maxCaptchaAttempts: maxAttempts }
					: {}),
				...(vehicleId !== null ? { vehicleId } : {}),
			},
			{
				artifactStore: ctx.artifactStore,
				captchaSolver: ctx.captchaSolver,
				log: ctx.log,
				runId: ctx.runId,
			},
		);
		return {
			artifactPath: output.artifactPath,
			output: { ...output },
		};
	},
};

registerWorkflow(puccWorkflowDefinition);
