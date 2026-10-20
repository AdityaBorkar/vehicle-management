import type { Page } from "patchright";

export const VAHAN_HOMEPAGE_URL =
	"https://vahan.parivahan.gov.in/vahanservice/vahan/ui/statevalidation/homepage.xhtml";

export const VAHAN_LOGIN_WORKFLOW_NAME = "vahan-login" as const;

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CLOSE_DIALOG_TIMEOUT_MS = 8_000;

export interface VahanLoginInput {
	/** Timeout for the optional "Close" promo dialog. Defaults to 8s. Missing dialog is not an error. */
	closeDialogTimeoutMs?: number;
	/** Vehicle registration number, e.g. "MH01CR7464". Spaces/hyphens are stripped. */
	registrationNumber: string;
	/** Timeout for page load and selector waits. Defaults to 30s. */
	timeoutMs?: number;
}

export interface VahanLoginResult {
	/** Page URL after the second "Proceed" click. */
	currentUrl: string;
	/** Normalized registration number that was entered. */
	registrationNumber: string;
}

export function normalizeRegistrationNumber(value: string): string {
	const normalized = value.toUpperCase().replace(/[\s-]+/g, "");
	if (!/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(normalized)) {
		throw new Error(
			`Invalid registrationNumber: "${value}". Expected format like "MH01CR7464".`,
		);
	}
	return normalized;
}

async function dismissPromoDialog(
	page: Page,
	timeoutMs: number,
): Promise<void> {
	const closeButton = page.locator("#updatemobileno button.btn-close");
	try {
		await closeButton.waitFor({ state: "visible", timeout: timeoutMs });
		await closeButton.click({ timeout: timeoutMs });
		await page
			.locator("#updatemobileno")
			.waitFor({ state: "hidden", timeout: timeoutMs })
			.catch(() => {});
	} catch {
		// Promo dialog did not appear — safe to continue.
	}
}

async function enterRegistrationNumber(
	page: Page,
	registrationNumber: string,
	timeoutMs: number,
): Promise<void> {
	const input = page.locator("#regnid");
	await input.waitFor({ state: "visible", timeout: timeoutMs });
	await input.fill(registrationNumber, { timeout: timeoutMs });

	const entered = await input.evaluate((el) =>
		(el as HTMLInputElement).value.toUpperCase().replace(/[\s-]+/g, ""),
	);
	if (entered !== registrationNumber) {
		throw new Error(
			`Failed to enter registration number. Expected "${registrationNumber}", found "${entered}".`,
		);
	}
}

async function acceptTnCAndProceed(
	page: Page,
	timeoutMs: number,
): Promise<void> {
	const checked = await page
		.locator(".ui-selectbooleancheckbox input[type=checkbox]")
		.evaluate((el) => (el as HTMLInputElement).checked)
		.catch(() => false);
	if (!checked) {
		const box = page.locator(".ui-selectbooleancheckbox .ui-chkbox-box");
		await box.waitFor({ state: "visible", timeout: timeoutMs });
		await box.click({ timeout: timeoutMs });
	}

	await page.waitForFunction(
		() => {
			const btn = document.querySelector<HTMLButtonElement>(
				"#proccedHomeButtonId",
			);
			return (
				btn !== null &&
				!btn.disabled &&
				!btn.classList.contains("ui-state-disabled")
			);
		},
		undefined,
		{ timeout: timeoutMs },
	);

	await page.locator("#proccedHomeButtonId").click({ timeout: timeoutMs });
}

async function confirmFacelessDialog(
	page: Page,
	timeoutMs: number,
): Promise<void> {
	await page
		.locator("#facelesslist")
		.waitFor({ state: "visible", timeout: timeoutMs });
	const proceed = page.locator('#facelesslist button:has-text("Proceed")');
	await proceed.waitFor({ state: "visible", timeout: timeoutMs });
	await proceed.click({ timeout: timeoutMs });
	await page
		.waitForLoadState("networkidle", { timeout: timeoutMs })
		.catch(() => {});
}

/**
 * Base workflow for all Vahan automations.
 *
 * Opens the Vahan homepage, dismisses the promo dialog, enters the
 * registration number, accepts TnC + clicks "Proceed", then confirms the
 * "Authentication Modes" dialog with a second "Proceed".
 *
 * The caller owns the `page`: this function never closes it so future
 * workflows (status, receipt, fitness, PUCC, …) can continue from here.
 */
export async function vahanLogin(
	page: Page,
	input: VahanLoginInput,
): Promise<VahanLoginResult> {
	const registrationNumber = normalizeRegistrationNumber(
		input.registrationNumber,
	);
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const closeDialogTimeoutMs =
		input.closeDialogTimeoutMs ?? DEFAULT_CLOSE_DIALOG_TIMEOUT_MS;

	await page.goto(VAHAN_HOMEPAGE_URL, {
		timeout: timeoutMs,
		waitUntil: "domcontentloaded",
	});
	await page
		.locator("#regnid")
		.waitFor({ state: "visible", timeout: timeoutMs });

	await dismissPromoDialog(page, closeDialogTimeoutMs);
	await enterRegistrationNumber(page, registrationNumber, timeoutMs);
	await acceptTnCAndProceed(page, timeoutMs);
	await confirmFacelessDialog(page, timeoutMs);

	return { currentUrl: page.url(), registrationNumber };
}
