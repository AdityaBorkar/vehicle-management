/**
 * Vahan "Know Your Application Status" search-mode form helpers.
 *
 * The live portal shares ONE entry box across modes — the checked mode
 * radio decides what the typed value means. Selecting "Vehicle Number"
 * (label-first, then box + explicit change kick for the AJAX panel swap)
 * and verifying it is still selected before typing is what keeps the
 * registration number out of the application-number field.
 */

import type { Page } from "patchright";

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

export interface RadioDescriptor {
	descriptor: string;
	/** Value/name/id/labels only — precise, no shared-container noise. */
	exact: string;
	index: number;
}

export async function listRadioDescriptors(
	page: Page,
): Promise<RadioDescriptor[]> {
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

function findVehicleRadio(radios: RadioDescriptor[]): RadioDescriptor | null {
	return (
		radios.find((r) => isVehicleNumberDescriptor(r.exact)) ??
		radios.find((r) => isVehicleNumberDescriptor(r.descriptor)) ??
		null
	);
}

export async function selectVehicleNumberOption(
	page: Page,
	timeoutMs: number,
	log: (...args: unknown[]) => void,
): Promise<void> {
	// Submitting while "Application Number" is selected sends the
	// registration number to the wrong field and the portal just reports
	// "no record", which used to burn all CAPTCHA retries.
	const radios = await listRadioDescriptors(page);
	if (radios.length === 0) {
		log("no radio buttons found — assuming vehicle-number is the default mode");
		return;
	}
	const target = findVehicleRadio(radios);
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

export type FieldKind = "application" | "captcha" | "unknown" | "vehicle";

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

export interface FieldSnapshot {
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
	const target = findVehicleRadio(radios);
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
	// The mode radio is authoritative for what the shared search box means,
	// so confirm it is still on Vehicle Number before typing anything.
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
