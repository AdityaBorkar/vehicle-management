/**
 * Vahan "Know Your Application Status" / Transaction History workflow.
 *
 * Flow (per requirements):
 * 1. Vahan login (shared `vahanLogin`: homepage → registration number →
 *    Proceed × 2).
 * 2. Open the "Status" menu, then "Know Your Application Status".
 * 3. Select the "Vehicle Number" radio button.
 * 4. Enter the vehicle (registration) number.
 * 5. Solve the CAPTCHA with Meta AI vision (same solver as PUCC).
 * 6. Submit and extract the application/transaction details table.
 * 7. Persist the snapshot to `vehicle_transactions` (replaces the previous
 *    snapshot for the vehicle) and return it as the run output.
 *
 * Vahan's JSF markup changes often, so every step tries several selectors
 * and falls back to generic text matching before giving up. CAPTCHA
 * failures are retried (refresh + re-solve, up to `maxCaptchaAttempts`);
 * non-CAPTCHA failures abort immediately.
 */

import { and, eq } from "drizzle-orm";
import type { Page } from "patchright";

import { vehicles, vehicleTransactions } from "#/db-schema";
import { db } from "#/lib/db";
import type { ArtifactStore } from "../artifact-store";
import type { CaptchaSolver } from "../captcha";
import { MIN_CAPTCHA_CONFIDENCE, solveCaptchaWithMetaAi } from "../captcha";
import type { WorkflowDefinition } from "../engine";
import { registerWorkflow } from "../engine";
import { browserAutomation } from "../index";
import { normalizeRegistrationNumber, vahanLogin } from "./vahan-login";

export { normalizeRegistrationNumber };

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

export interface VahanTransactionRecord {
	applicationNumber?: string | null;
	raw: Record<string, string>;
	remarks?: string | null;
	serviceType?: string | null;
	status?: string | null;
	transactionDate?: string | null;
}

export interface VahanTransactionHistoryOutput {
	details: Record<string, string>;
	fetchedAt: string;
	registrationNumber: string;
	transactions: VahanTransactionRecord[];
}

/** Column-header aliases for the application-status result table. */
const COLUMN_ALIASES: Record<
	Exclude<keyof VahanTransactionRecord, "raw">,
	string[]
> = {
	applicationNumber: ["application", "appln", "receipt", "ref no", "reference"],
	remarks: ["remark", "comment", "narration", "purpose"],
	serviceType: ["service", "transaction", "trn", "trans", "type", "particular"],
	status: ["status", "stage", "state"],
	transactionDate: ["date", "dt", "time", "on"],
};

function cleanText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function pickField(
	row: Record<string, string>,
	key: keyof typeof COLUMN_ALIASES,
): string | null {
	const aliases = COLUMN_ALIASES[key] ?? [];
	const entries = Object.entries(row);
	for (const alias of aliases) {
		const hit = entries.find(([label]) => label.toLowerCase().includes(alias));
		if (hit?.[1]) {
			const v = cleanText(hit[1]);
			if (v) return v;
		}
	}
	return null;
}

export function parseTxDate(value: string | null): string | null {
	if (!value) return null;
	const text = value.trim().split(" ")[0] ?? "";
	const m = text.match(/^(\d{1,2})[-/](\d{1,2}|[A-Za-z]{3})[-/](\d{2,4})$/);
	if (!m) {
		const iso = Date.parse(text);
		if (Number.isNaN(iso)) return value;
		return new Date(iso).toISOString().slice(0, 10);
	}
	const [, d, mon, y] = m;
	const months: Record<string, string> = {
		apr: "04",
		aug: "08",
		dec: "12",
		feb: "02",
		jan: "01",
		jul: "07",
		jun: "06",
		mar: "03",
		may: "05",
		nov: "11",
		oct: "10",
		sep: "09",
	};
	let month = mon ?? "";
	if (/[A-Za-z]/.test(month)) {
		month = months[month.toLowerCase().slice(0, 3)] ?? "";
	} else {
		month = month.padStart(2, "0");
	}
	if (!month) return value;
	let year = y ?? "";
	if (year.length === 2) year = `20${year}`;
	const day = (d ?? "").padStart(2, "0");
	const iso = `${year}-${month}-${day}`;
	return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : value;
}

export function toTransactionRecord(
	row: Record<string, string>,
): VahanTransactionRecord | null {
	const cleaned: Record<string, string> = {};
	for (const [k, v] of Object.entries(row)) {
		const label = cleanText(k);
		const val = cleanText(v);
		if (label && val) cleaned[label] = val;
	}
	if (Object.keys(cleaned).length === 0) return null;
	return {
		applicationNumber: pickField(cleaned, "applicationNumber"),
		raw: cleaned,
		remarks: pickField(cleaned, "remarks"),
		serviceType: pickField(cleaned, "serviceType"),
		status: pickField(cleaned, "status"),
		transactionDate: parseTxDate(pickField(cleaned, "transactionDate")),
	};
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
	// Step 2: Status → Know Your Application Status.
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

/** Normalize a descriptor for keyword matching: split camelCase, drop punctuation. */
function normalizeDescriptor(value: string): string {
	return ` ${value
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")} `;
}

function hasVehicleKeywords(value: string): boolean {
	const text = normalizeDescriptor(value);
	return (
		text.includes(" vehicle ") ||
		text.includes(" regn ") ||
		text.includes(" reg ") ||
		text.includes(" regno ") ||
		text.includes(" regnno ") ||
		text.includes(" vehicleno ") ||
		text.includes(" registration ")
	);
}

/**
 * True when a radio/input descriptor refers to the vehicle-number search
 * mode ("Vehicle Number", "Vehicle No", "Registration No", "Regn No"...).
 * Pure so it can be unit-tested.
 */
export function isVehicleNumberDescriptor(value: string): boolean {
	const text = normalizeDescriptor(value);
	if (
		/\bappln\b|\bapplication\b|\breceipt\b|\breference\b|\bref\b/.test(text)
	) {
		return false;
	}
	return hasVehicleKeywords(text);
}

/** True when a descriptor refers to the application-number search mode. */
export function isApplicationNumberDescriptor(value: string): boolean {
	const text = normalizeDescriptor(value);
	return (
		text.includes(" application ") ||
		text.includes(" appln ") ||
		text.includes(" receipt ") ||
		text.includes(" reference ") ||
		text.includes(" ref ")
	);
}

interface RadioDescriptor {
	descriptor: string;
	/** Value/name/id/labels only — precise, no shared-container noise. */
	exact: string;
	index: number;
}

async function listRadioDescriptors(page: Page): Promise<RadioDescriptor[]> {
	return page
		.evaluate(() => {
			const norm = (s: string | null | undefined) =>
				(s ?? "").replace(/\s+/g, " ").trim();
			const inputs = Array.from(
				document.querySelectorAll<HTMLInputElement>("input[type='radio']"),
			);
			return inputs.map((input, index) => {
				const id = input.id ?? "";
				const forLabel = id
					? ((
							document.querySelector(
								`label[for="${CSS.escape(id)}"]`,
							) as HTMLElement | null
						)?.textContent ?? "")
					: "";
				const wrappedLabel = input.closest("label")?.textContent ?? "";
				const cell =
					input.closest("td")?.textContent ??
					input.parentElement?.textContent ??
					"";
				// Div-based layouts keep the option text in a sibling element.
				const nextText =
					input.closest("div.ui-radiobutton, span.ui-radiobutton")
						?.nextElementSibling?.textContent ??
					input.nextElementSibling?.textContent ??
					"";
				const exact = [input.value ?? "", input.name ?? "", id, forLabel]
					.map(norm)
					.filter(Boolean)
					.join(" | ");
				const descriptor = [exact, wrappedLabel, cell, nextText]
					.map(norm)
					.filter(Boolean)
					.join(" | ");
				return { descriptor, exact, index };
			});
		})
		.catch(() => []);
}

async function isRadioChecked(page: Page, index: number): Promise<boolean> {
	return page
		.locator("input[type='radio']")
		.nth(index)
		.evaluate((el) => (el as HTMLInputElement).checked === true)
		.catch(() => false);
}

/**
 * Click the radio at `index` the way a real user would. Order matters: the
 * associated `<label for>` fires native click+change (which is what the
 * portal's AJAX panel swap listens for); the PrimeFaces box span and a
 * forced input click are fallbacks.
 */
async function clickRadio(
	page: Page,
	index: number,
	timeoutMs: number,
): Promise<void> {
	const radio = page.locator("input[type='radio']").nth(index);
	const id = await radio.getAttribute("id").catch(() => null);
	if (id) {
		const label = page.locator(`label[for="${id}"]`);
		try {
			if ((await label.count()) > 0) {
				await label
					.first()
					.scrollIntoViewIfNeeded()
					.catch(() => {});
				await label.first().click({ timeout: 8000 });
				await page.waitForTimeout(800);
				if (await isRadioChecked(page, index)) {
					await kickPanelUpdate(page, index);
					return;
				}
			}
		} catch {
			// Covered label or missed toggle — try the box span next.
		}
	}
	const clicked = await radio
		.evaluate((node) => {
			const input = node as HTMLInputElement;
			const scope =
				input.closest("td, div.ui-radiobutton, span.ui-radiobutton, li") ??
				input.parentElement;
			const box = scope?.querySelector<HTMLElement>(".ui-radiobutton-box");
			if (box) {
				box.click();
				return "box";
			}
			input.click();
			return "input";
		})
		.catch(() => "error" as const);
	if (clicked === "error") {
		await radio.scrollIntoViewIfNeeded().catch(() => {});
		await radio.click({ force: true, timeout: timeoutMs }).catch(() => {});
	}
	await kickPanelUpdate(page, index);
	await page.waitForTimeout(800);
}

/**
 * A merely-checked radio doesn't always fire the panel-update AJAX —
 * programmatic checks skip the change event the portal listens for. Fire
 * it explicitly (native + jQuery, whichever the portal uses).
 */
async function kickPanelUpdate(page: Page, index: number): Promise<void> {
	await page
		.locator("input[type='radio']")
		.nth(index)
		.evaluate((node) => {
			const input = node as HTMLInputElement;
			input.dispatchEvent(new Event("change", { bubbles: true }));
			const w = window as unknown as {
				jQuery?: (el: Element) => { trigger(e: string): void };
			};
			try {
				w.jQuery?.(input).trigger("change");
			} catch {
				// Portals without jQuery — the native event above suffices.
			}
		})
		.catch(() => {});
}

export async function selectVehicleNumberOption(
	page: Page,
	timeoutMs: number,
	log: (...args: unknown[]) => void,
): Promise<void> {
	// Step 3: select the "Vehicle Number" radio button — and verify it is
	// actually checked. Submitting while "Application Number" is selected
	// sends the registration number to the wrong field and the portal just
	// reports "no record", which used to burn all CAPTCHA retries.
	const radios = await listRadioDescriptors(page);
	if (radios.length === 0) {
		log("no radio buttons found — assuming vehicle-number is the default mode");
		return;
	}
	const target =
		// Prefer the precise fields first: a shared container's text can
		// mention both options, which would match (and reject) everything.
		radios.find((r) => isVehicleNumberDescriptor(r.exact)) ??
		radios.find((r) => isVehicleNumberDescriptor(r.descriptor));
	if (!target) {
		throw new Error(
			`Could not find a "Vehicle Number" search option. Radio options on the page: ${radios
				.map((r) => `"${r.descriptor}"`)
				.join("; ")
				.slice(0, 400)}`,
		);
	}
	log(`selecting Vehicle Number radio: "${target.descriptor}"`);
	for (let attempt = 1; attempt <= 3; attempt++) {
		if (await isRadioChecked(page, target.index)) {
			log(`Vehicle Number radio confirmed checked (attempt ${attempt})`);
			// Checked is not enough — the panel swap listens for change,
			// which a pre-checked or programmatic check may never fire.
			await kickPanelUpdate(page, target.index);
			await page.waitForTimeout(1200);
			return;
		}
		await clickRadio(page, target.index, timeoutMs);
	}
	if (await isRadioChecked(page, target.index)) {
		log("Vehicle Number radio confirmed checked");
		await kickPanelUpdate(page, target.index);
		await page.waitForTimeout(1200);
		return;
	}
	const states = await Promise.all(
		radios.map(async (r) => ({
			checked: await isRadioChecked(page, r.index),
			descriptor: r.descriptor,
		})),
	);
	throw new Error(
		`Could not select the "Vehicle Number" radio button after 3 attempts. Radio states: ${states
			.map((s) => `${s.checked ? "[x]" : "[ ]"} "${s.descriptor}"`)
			.join("; ")
			.slice(0, 500)}`,
	);
}

async function describeTextInput(
	page: Page,
	index: number,
): Promise<{ descriptor: string; exact: string }> {
	const empty = { descriptor: "", exact: "" };
	return page
		.locator("input[type='text'], input:not([type])")
		.nth(index)
		.evaluate((node) => {
			const norm = (s: string | null | undefined) =>
				(s ?? "").replace(/\s+/g, " ").trim();
			const input = node as HTMLInputElement;
			const id = input.id ?? "";
			const forLabel = id
				? ((
						document.querySelector(
							`label[for="${CSS.escape(id)}"]`,
						) as HTMLElement | null
					)?.textContent ?? "")
				: "";
			const exact = [id, input.name ?? "", input.placeholder ?? "", forLabel]
				.map(norm)
				.filter(Boolean)
				.join(" | ");
			const descriptor = [
				exact,
				input.closest("label")?.textContent ?? "",
				input.closest("td, div, span")?.querySelector("label")?.textContent ??
					"",
			]
				.map(norm)
				.filter(Boolean)
				.join(" | ");
			return { descriptor, exact };
		})
		.catch(() => empty);
}

/** CAPTCHA / OTP / mobile inputs must never receive the registration number. */
export function isCaptchaLikeDescriptor(value: string): boolean {
	const text = normalizeDescriptor(value);
	return (
		text.includes(" captcha ") ||
		text.includes(" otp ") ||
		text.includes(" mobile ") ||
		text.includes(" phone ") ||
		text.includes(" verify ") ||
		text.includes(" verification ") ||
		text.includes(" security ")
	);
}

type FieldKind = "application" | "captcha" | "unknown" | "vehicle";

/**
 * Classify a text input. Precise identifiers (id/name/placeholder/its own
 * label) win; noisy container text is only a fallback, so an input sitting
 * next to both search-mode labels is "unknown", not "application".
 */
/**
 * Classify container text when an input's own identifiers are uninformative.
 * Container text mentioning both search modes identifies nothing — that is
 * "unknown", never a guess.
 */
function classifyContext(descriptor: string): FieldKind | null {
	if (isVehicleNumberDescriptor(descriptor)) return "vehicle";
	if (
		isApplicationNumberDescriptor(descriptor) &&
		!hasVehicleKeywords(descriptor)
	) {
		return "application";
	}
	return null;
}

export function classifyField(exact: string, descriptor: string): FieldKind {
	if (isCaptchaLikeDescriptor(exact)) return "captcha";
	if (isVehicleNumberDescriptor(exact)) return "vehicle";
	if (isApplicationNumberDescriptor(exact)) return "application";
	if (isCaptchaLikeDescriptor(descriptor)) return "captcha";
	return classifyContext(descriptor) ?? "unknown";
}

interface FieldSnapshot {
	descriptor: string;
	editable: boolean;
	index: number;
	kind: FieldKind;
	visible: boolean;
}

async function snapshotTextInputs(
	page: Page,
	selector: string,
): Promise<FieldSnapshot[]> {
	const total = await page
		.locator(selector)
		.count()
		.catch(() => 0);
	const rows: FieldSnapshot[] = [];
	for (let i = 0; i < Math.min(total, 12); i++) {
		const { descriptor, exact } = await describeTextInput(page, i);
		const locator = page.locator(selector).nth(i);
		const visible = await locator.isVisible().catch(() => false);
		const editable = visible
			? await locator
					.evaluate((el) => {
						const node = el as HTMLInputElement;
						return !node.disabled && !node.readOnly;
					})
					.catch(() => false)
			: false;
		rows.push({
			descriptor: descriptor || "(unlabeled)",
			editable,
			index: i,
			kind: classifyField(exact, descriptor),
			visible,
		});
	}
	return rows;
}

/**
 * Re-assert the Vehicle Number radio is still selected. The search box is
 * shared between modes on this portal, so the radio — not the box label —
 * decides what the typed value means. Filling the box while Application
 * mode is active would submit the regn number as an application number.
 */
export async function assertVehicleMode(page: Page): Promise<void> {
	const radios = await listRadioDescriptors(page);
	const target =
		radios.find((r) => isVehicleNumberDescriptor(r.exact)) ??
		radios.find((r) => isVehicleNumberDescriptor(r.descriptor));
	if (!target) {
		throw new Error("Vehicle Number search option not found on the page.");
	}
	if (!(await isRadioChecked(page, target.index))) {
		throw new Error(
			"Vehicle Number radio is no longer selected — refusing to fill the search box.",
		);
	}
}

/**
 * Find the box that takes the registration number.
 *
 * Two portal designs are handled. Dedicated-box portals render a separate
 * vehicle field after the radio change (found via its vehicle-like
 * identifiers while the panel settles — hence the polling). The live
 * "Know Your Application Status" form instead shares ONE entry box
 * (`tf_entry`) across modes: the checked mode radio decides what the
 * value means. In that case the single visible, editable, non-CAPTCHA
 * box is the target. CAPTCHA inputs are never candidates.
 */
async function waitForVehicleField(
	page: Page,
	timeoutMs: number,
	log: (...args: unknown[]) => void,
): Promise<FieldSnapshot> {
	const selector = "input[type='text'], input:not([type])";
	const deadline = Date.now() + Math.min(Math.max(timeoutMs, 5000), 30000);
	let last: FieldSnapshot[] = [];
	for (;;) {
		const rows = await snapshotTextInputs(page, selector);
		last = rows;
		const usable = rows.filter(
			(r) => r.kind !== "captcha" && r.visible && r.editable,
		);
		const vehicle = usable.find((r) => r.kind === "vehicle");
		if (vehicle) return vehicle;
		const vehiclePending = rows.some((r) => r.kind === "vehicle");
		if (!vehiclePending && usable.length === 1) {
			// Shared-box portal: the mode radio is authoritative, and it
			// was verified before this wait started.
			const only = usable[0] as FieldSnapshot;
			log(`using shared search box in vehicle mode: "${only.descriptor}"`);
			return only;
		}
		if (Date.now() >= deadline) break;
		await page.waitForTimeout(500);
	}
	const summary =
		last
			.map(
				(r) =>
					`[${r.kind}${r.visible ? ",visible" : ""}${r.editable ? ",editable" : ""}] "${r.descriptor}"`,
			)
			.join("; ")
			.slice(0, 600) || "(no text inputs on page)";
	throw new Error(
		`Vehicle Number search field not found or not editable — the page may still be in Application Number mode. Text inputs on page: ${summary}`,
	);
}

export async function fillVehicleNumber(
	page: Page,
	registrationNumber: string,
	timeoutMs: number,
	log: (...args: unknown[]) => void,
): Promise<void> {
	// Step 4: enter the vehicle (registration) number. The mode radio is
	// authoritative for what the shared search box means, so confirm it is
	// still on Vehicle Number before typing anything.
	await assertVehicleMode(page);
	const field = await waitForVehicleField(page, timeoutMs, log);
	const input = page
		.locator("input[type='text'], input:not([type])")
		.nth(field.index);
	try {
		await input.waitFor({ state: "visible", timeout: timeoutMs });
	} catch {
		throw new Error(
			`Vehicle Number search field disappeared before it could be filled ("${field.descriptor}").`,
		);
	}
	await input.fill("", { timeout: timeoutMs }).catch(() => {});
	await input.fill(registrationNumber, { timeout: timeoutMs });
	const entered = await input
		.evaluate((el) =>
			(el as HTMLInputElement).value.toUpperCase().replace(/[\s-]+/g, ""),
		)
		.catch(() => "");
	if (entered !== registrationNumber) {
		throw new Error(
			`Vehicle Number search field rejected the input ("${field.descriptor}").`,
		);
	}
	log(`entered vehicle number into: "${field.descriptor}"`);
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
	return /no record|not found|no data|invalid.*(vehicle|registration|application)|no.*transaction/i.test(
		text,
	);
}

async function extractSummaryPairs(
	page: Page,
): Promise<Record<string, string>> {
	return page
		.evaluate(() => {
			const out: Record<string, string> = {};
			const push = (label: string, value: string) => {
				const l = label.replace(/\s+/g, " ").trim();
				const v = value.replace(/\s+/g, " ").trim();
				if (l && v && l.length < 80 && !(l in out)) out[l] = v;
			};
			document.querySelectorAll("table").forEach((table) => {
				table.querySelectorAll("tr").forEach((tr) => {
					const cells = Array.from(tr.querySelectorAll("th, td"));
					if (cells.length >= 2) {
						push(
							cells[0]?.textContent ?? "",
							cells
								.slice(1)
								.map((c) => c.textContent ?? "")
								.join(" "),
						);
					}
				});
			});
			return out;
		})
		.catch(() => ({}));
}

async function extractTransactionRows(
	page: Page,
): Promise<Record<string, string>[]> {
	return page
		.evaluate(() => {
			const norm = (s: string) => s.replace(/\s+/g, " ").trim();
			const keywordScore = (headers: string[]) => {
				const joined = headers.join(" ").toLowerCase();
				let score = 0;
				for (const kw of [
					"application",
					"appln",
					"transaction",
					"service",
					"status",
					"receipt",
					"date",
					"amount",
					"fee",
				]) {
					if (joined.includes(kw)) score += 1;
				}
				return score;
			};
			let best: Record<string, string>[] = [];
			let bestScore = 0;
			document.querySelectorAll("table").forEach((table) => {
				const rows = Array.from(table.querySelectorAll("tr"));
				if (rows.length < 2) return;
				const headerCells = Array.from(
					rows[0]?.querySelectorAll("th, td") ?? [],
				).map((c) => norm(c.textContent ?? ""));
				if (headerCells.filter(Boolean).length < 2) return;
				const score = keywordScore(headerCells);
				const body = rows.slice(1).map((tr) => {
					const cells = Array.from(tr.querySelectorAll("td, th")).map((c) =>
						norm(c.textContent ?? ""),
					);
					const obj: Record<string, string> = {};
					headerCells.forEach((h, i) => {
						const key = h || `Column ${i + 1}`;
						obj[key] = cells[i] ?? "";
					});
					return obj;
				});
				const nonEmpty = body.filter((r) => Object.values(r).some((v) => v));
				if (nonEmpty.length === 0) return;
				if (
					score > bestScore ||
					(score === bestScore && nonEmpty.length > best.length)
				) {
					bestScore = score;
					best = nonEmpty;
				}
			});
			return best;
		})
		.catch(() => []);
}

function hasResultContent(
	details: Record<string, string>,
	rows: Record<string, string>[],
	bodyText: string,
	registrationNumber: string,
): boolean {
	if (rows.length > 0) return true;
	if (Object.keys(details).length > 0) return true;
	const upper = bodyText.toUpperCase();
	return (
		upper.includes(registrationNumber.toUpperCase()) &&
		/APPLICATION|TRANSACTION|STATUS|RECEIPT/.test(upper)
	);
}

export async function runTransactionHistoryWithPage(
	page: Page,
	input: VahanTransactionHistoryInput,
	deps?: Partial<{
		artifactStore: ArtifactStore;
		captchaSolver: CaptchaSolver;
		log: (...args: unknown[]) => void;
		runId: number;
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

	// Step 1: Vahan login.
	await vahanLogin(page, { registrationNumber, timeoutMs });

	// Step 2: Status → Know Your Application Status.
	await openApplicationStatusPage(page, timeoutMs);

	// Step 3 + 4: Vehicle Number radio + registration number.
	await selectVehicleNumberOption(page, timeoutMs, log);
	await fillVehicleNumber(page, registrationNumber, timeoutMs, log);

	// Steps 5 + 6: CAPTCHA solve + Submit (with retries).
	let lastError = "";
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		if (attempt > 1) {
			log(`refreshing CAPTCHA (attempt ${attempt}/${maxAttempts})`);
			await refreshCaptchaImage(page);
			try {
				// A refresh/reload resets the search-mode radio to its
				// default (Application Number), so re-select before re-fill.
				await selectVehicleNumberOption(page, timeoutMs, log);
				await fillVehicleNumber(page, registrationNumber, timeoutMs, log);
			} catch {
				// Form may still hold the value after refresh.
			}
		}
		let captchaBytes: Buffer;
		try {
			const captured = await captureCaptcha(page, timeoutMs);
			captchaBytes = captured.bytes;
		} catch (err) {
			lastError = `CAPTCHA image not found: ${err instanceof Error ? err.message : String(err)}`;
			log(lastError);
			continue;
		}
		log(
			`solving CAPTCHA (attempt ${attempt}/${maxAttempts}, ${captchaBytes.length} bytes)`,
		);
		let code: string;
		let confidence = 0;
		try {
			const solution = await solver(captchaBytes);
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

		await fillCaptchaAndSubmit(page, code, timeoutMs);

		const messages = await readPortalMessages(page);
		if (messages && isCaptchaFailure(messages)) {
			lastError = `CAPTCHA rejected by portal: ${messages.slice(0, 300)}`;
			log(lastError);
			continue;
		}
		if (messages && isNoRecordFailure(messages)) {
			throw new Error(
				`No transactions found for "${registrationNumber}": ${messages.slice(0, 500)}`,
			);
		}

		// Step 7: extract details.
		const [details, rows] = await Promise.all([
			extractSummaryPairs(page),
			extractTransactionRows(page),
		]);
		const bodyText = await page
			.evaluate(() => document.body?.innerText ?? "")
			.catch(() => "");
		if (!hasResultContent(details, rows, bodyText, registrationNumber)) {
			lastError = messages
				? `Application status lookup failed: ${messages.slice(0, 500)}`
				: "No transaction details detected after submit.";
			log(lastError);
			continue;
		}

		const transactions = rows
			.map((r) => toTransactionRecord(r))
			.filter((r): r is VahanTransactionRecord => r !== null);
		return {
			details,
			fetchedAt: new Date().toISOString(),
			registrationNumber,
			transactions:
				transactions.length > 0
					? transactions
					: details && Object.keys(details).length > 0
						? [
								{
									applicationNumber: null,
									raw: details,
									remarks: null,
									serviceType: null,
									status: null,
									transactionDate: null,
								},
							]
						: [],
		};
	}

	throw new Error(
		`Application-status CAPTCHA failed after ${maxAttempts} attempt(s). ${lastError}`.trim(),
	);
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
		headless?: boolean;
		log: (...args: unknown[]) => void;
		runId: number;
	}>,
): Promise<VahanTransactionHistoryOutput> {
	const page = await browserAutomation.newPage();
	try {
		return await runTransactionHistoryWithPage(page, input, deps);
	} finally {
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
	name: VAHAN_TRANSACTION_HISTORY_WORKFLOW_NAME,
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
		const output = await fetchTransactionHistoryDirect(
			{
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
		if (vehicleId !== null) {
			const [vehicle] = await db
				.select({ id: vehicles.id })
				.from(vehicles)
				.where(
					and(eq(vehicles.id, vehicleId), eq(vehicles.userId, ctx.userId)),
				);
			if (vehicle) {
				await storeTransactionHistory(ctx.userId, vehicle.id, output);
			} else {
				ctx.log(`vehicle #${vehicleId} not found — skipping DB snapshot`);
			}
		}
		return { output: { ...output } };
	},
};

registerWorkflow(vahanTransactionHistoryWorkflowDefinition);
