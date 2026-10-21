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
import { z } from "zod";

import {
	normalizeChassisLast5,
	normalizeRegistrationNumber,
} from "#/lib/vehicle-registration";

export { normalizeChassisLast5 };

import type { ArtifactStore } from "../artifact-store";
import { getArtifactStore } from "../artifact-store";
import type { CaptchaSolver } from "../captcha";
import { solveCaptchaWithMetaAi } from "../captcha";
import { runCaptchaLoop } from "../captcha-flow";
import type { WorkflowDefinition } from "../engine";
import { parseWorkflowInput, registerWorkflow } from "../engine";
import { browserAutomation } from "../index";
import { attachConsoleCapture, finalizeConsoleLog } from "../observability";
import { isNoRecordFailure, readPortalMessages } from "../portal-messages";

export const PUCC_WORKFLOW_NAME = "pucc-fetch" as const;

export const puccInputSchema = z.object({
	chassisLast5: z
		.string()
		.min(5)
		.max(5)
		.refine(
			(v) => {
				try {
					normalizeChassisLast5(v);
					return true;
				} catch {
					return false;
				}
			},
			{ message: "Enter exactly the last 5 characters (A-Z, 0-9)." },
		),
	maxCaptchaAttempts: z.number().int().min(1).max(10).optional(),
	registrationNumber: z
		.string()
		.min(1)
		.max(20)
		.refine(
			(v) => {
				try {
					normalizePuccRegistrationNumber(v);
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
	vehicleId: z.number().int().optional(),
});

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
	const formatted = normalizeRegistrationNumber(value);
	if (formatted.length > 10) {
		throw new Error(
			`Invalid registration number: "${formatted}" exceeds 10 characters (PUC portal limit).`,
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

async function submitCaptchaCode(
	page: Page,
	code: string,
	timeoutMs: number,
): Promise<void> {
	const captchaInput = page.locator("#txtCaptchaId");
	await captchaInput.waitFor({ state: "visible", timeout: timeoutMs });
	await captchaInput.fill(code, { timeout: timeoutMs });
	await submitAndSettle(page, timeoutMs);
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
): Promise<PuccWorkflowOutput> {
	const registrationNumber = normalizePuccRegistrationNumber(
		input.registrationNumber,
	);
	const chassisLast5 = normalizeChassisLast5(input.chassisLast5);
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxAttempts = input.maxCaptchaAttempts ?? DEFAULT_MAX_CAPTCHA_ATTEMPTS;
	const solver = deps?.captchaSolver ?? solveCaptchaWithMetaAi;
	const store = deps?.artifactStore ?? getArtifactStore();
	const log =
		deps?.log ?? ((...args: unknown[]) => console.log("[pucc]", ...args));
	const warn =
		deps?.events?.warn ??
		((label: string, message: string) => log(`WARN ${label}: ${message}`));

	await page.goto(PUCC_URL, {
		timeout: timeoutMs,
		waitUntil: "domcontentloaded",
	});
	await page
		.locator("#regnNumber")
		.waitFor({ state: "visible", timeout: timeoutMs });
	await fillPuccForm(page, registrationNumber, chassisLast5, timeoutMs);

	// CAPTCHA solve + submit with retries; no-record aborts immediately.
	// A submit with no portal error but no certificate content retries;
	// when the result page renders *something* without our markers (form
	// gone, no messages) the run still saves the PDF as unverified so the
	// run stays auditable instead of failing blind.
	let resultKind: "verified" | "unverified" = "verified";
	let loop: { attemptsUsed: number; confidence: number };
	try {
		loop = await runCaptchaLoop({
			captureImage: () => captureCaptchaImage(page, timeoutMs),
			hasResult: async (messages) => {
				if (await hasCertificateContent(page, registrationNumber)) {
					resultKind = "verified";
					return true;
				}
				const formStillThere = (await page.locator("#showDetails").count()) > 0;
				if (!formStillThere && !messages) {
					resultKind = "unverified";
					return true;
				}
				return false;
			},
			isNoRecordMessage: isNoRecordFailure,
			log,
			maxAttempts,
			readMessages: () => readPortalMessages(page),
			refreshForRetry: async () => {
				await refreshCaptcha(page);
				// Re-fill: a refresh/reload can clear the form.
				try {
					await fillPuccForm(page, registrationNumber, chassisLast5, timeoutMs);
				} catch {
					// Form may already hold values — continue to solve.
				}
			},
			solver,
			submitCode: (code) => submitCaptchaCode(page, code, timeoutMs),
			warn,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (isNoRecordFailure(message)) {
			throw new Error(`PUC lookup failed: ${message.slice(0, 500)}`);
		}
		throw new Error(
			`PUC CAPTCHA failed after ${maxAttempts} attempt(s). ${message}`.trim(),
		);
	}

	const printPage = await clickPrintForPopup(page, timeoutMs, log);
	const pdf = await savePageAsPdf(printPage ?? page);
	await printPage?.close().catch(() => {});
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const runSegment = deps?.runId ? `run-${deps.runId}` : "adhoc";
	const suffix = resultKind === "verified" ? "pucc.pdf" : "pucc-unverified.pdf";
	const saved = await store.save(
		`pucc/${registrationNumber}/${stamp}-${runSegment}-${suffix}`,
		pdf,
		{ contentType: "application/pdf" },
	);
	return {
		artifactPath: saved.relativePath,
		artifactRelativePath: saved.relativePath,
		attemptsUsed: loop.attemptsUsed,
		captchaConfidence: loop.confidence,
		fetchedAt: new Date().toISOString(),
		printButtonUsed: printPage !== null,
		registrationNumber,
	};
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
): Promise<PuccWorkflowOutput> {
	const page = await browserAutomation.newPage();
	const capture =
		deps?.runId && deps?.userId
			? attachConsoleCapture(page, deps.runId, deps.userId)
			: null;
	try {
		return await runPuccWithPage(page, input, deps);
	} finally {
		capture?.detach();
		if (capture && deps?.runId && deps?.userId) {
			await finalizeConsoleLog(deps.runId, deps.userId, capture.lines);
		}
		await page.close().catch(() => {});
	}
}

export const puccWorkflowDefinition: WorkflowDefinition = {
	inputSchema: puccInputSchema,
	meta: {
		description:
			"Enqueues a background browser run: PUC portal + Meta AI CAPTCHA solve + PDF artifact.",
		displayName: "PUC Certificate (async)",
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
						normalizePuccRegistrationNumber(v);
						return null;
					} catch (err) {
						return err instanceof Error
							? err.message
							: "Invalid registration number.";
					}
				},
			},
			{
				help: "Last 5 characters of the chassis number",
				label: "Chassis last 5 chars",
				name: "chassisLast5",
				placeholder: "12345",
				required: true,
				type: "chassisLast5",
				validate: (v: string) => {
					try {
						normalizeChassisLast5(v);
						return null;
					} catch (err) {
						return err instanceof Error
							? err.message
							: "Invalid chassis suffix.";
					}
				},
			},
			{
				help: "Link the run to a vehicle record",
				label: "Vehicle ID",
				name: "vehicleId",
				placeholder: "1",
				required: false,
				type: "vehicleId",
				validate: (v: string) => {
					if (!v.trim()) return null;
					return /^\d+$/.test(v.trim()) ? null : "Enter a numeric vehicle ID.";
				},
			},
		],
	},
	name: PUCC_WORKFLOW_NAME,
	run: async (ctx) => {
		const parsed = parseWorkflowInput<{
			chassisLast5: string;
			maxCaptchaAttempts?: number | undefined;
			registrationNumber: string;
			vehicleId?: number | undefined;
		}>(puccInputSchema, ctx.input);
		const output = await fetchPuccCertificateDirect(
			{
				chassisLast5: parsed.chassisLast5,
				registrationNumber: parsed.registrationNumber,
				...(parsed.maxCaptchaAttempts !== undefined
					? { maxCaptchaAttempts: parsed.maxCaptchaAttempts }
					: {}),
				...(parsed.vehicleId !== undefined
					? { vehicleId: parsed.vehicleId }
					: {}),
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
		return {
			artifactPath: output.artifactPath,
			output: { ...output },
		};
	},
};

registerWorkflow(puccWorkflowDefinition);
