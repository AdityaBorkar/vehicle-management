/**
 * Shared portal-message helpers for browser workflows.
 *
 * PUCC and Vahan both render PrimeFaces/JSF messages in the same
 * containers (`#messages`, `.ui-messages-error`, ...). Classifying them
 * in one place keeps the CAPTCHA-retry vs abort decision consistent.
 */

import type { Page } from "patchright";

const CAPTCHA_RE =
	/captch|security code|invalid.*code|incorrect|mismatch|wrong|try again|expired/i;
const NO_RECORD_RE =
	/no record|not found|no data|invalid.*(vehicle|registration|application|chassis)|mismatch.*chassis|no.*transaction/i;

export function isCaptchaFailure(text: string): boolean {
	return CAPTCHA_RE.test(text);
}

export function isNoRecordFailure(text: string): boolean {
	return NO_RECORD_RE.test(text);
}

/** Read PrimeFaces/JSF portal messages into a single normalized string. */
export async function readPortalMessages(page: Page): Promise<string> {
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
