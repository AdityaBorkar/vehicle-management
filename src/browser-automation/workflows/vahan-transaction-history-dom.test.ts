/**
 * DOM-level regression tests for the Vehicle Number search-mode fix.
 *
 * The live failure: the workflow typed the registration number while the
 * "Application Number" radio was still selected (the input panel swaps via
 * AJAX after the radio click), then burned all CAPTCHA retries. These
 * tests emulate the Vahan "Know Your Application Status" page with jsdom —
 * including a delayed panel swap — and drive the real
 * `selectVehicleNumberOption` / `fillVehicleNumber` functions through a
 * minimal `Page` adapter.
 */

import { JSDOM } from "jsdom";
import type { Page } from "patchright";
import { afterEach, describe, expect, it } from "vitest";

import {
	fillVehicleNumber,
	selectVehicleNumberOption,
} from "#/browser-automation/workflows/vahan-transaction-history";

const VIN = "MH11CH7041";
const noopLog = () => {};

/* ------------------------------------------------------------------ */
/* Minimal patchright Page adapter over a jsdom document.              */
/* ------------------------------------------------------------------ */

function isVisibleEl(el: Element | null): boolean {
	if (!el || !el.isConnected) return false;
	let node: Element | null = el;
	while (node) {
		if ((node as HTMLElement).hidden) return false;
		const tag = node.tagName.toLowerCase();
		if (tag === "input" && (node as HTMLInputElement).type === "hidden") {
			return false;
		}
		const style = (node as HTMLElement).style;
		if (style?.display === "none" || style?.visibility === "hidden") {
			return false;
		}
		const attrStyle = node.getAttribute("style") ?? "";
		if (/display\s*:\s*none/i.test(attrStyle)) return false;
		node = node.parentElement;
	}
	return true;
}

interface FakeLocator {
	click: (opts?: { force?: boolean; timeout?: number }) => Promise<void>;
	count: () => Promise<number>;
	evaluate: <T>(fn: (el: Element) => T | Promise<T>) => Promise<T>;
	fill: (value: string, opts?: { timeout?: number }) => Promise<void>;
	first: () => FakeLocator;
	getAttribute: (name: string) => Promise<string | null>;
	isVisible: () => Promise<boolean>;
	nth: (index: number) => FakeLocator;
	scrollIntoViewIfNeeded: () => Promise<void>;
	waitFor: (opts?: { state?: string; timeout?: number }) => Promise<void>;
}

interface FakePage {
	evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
	locator: (selector: string) => FakeLocator;
	waitForTimeout: (ms: number) => Promise<void>;
}

function makeFakePage(doc: Document): FakePage {
	const view = doc.defaultView as unknown as {
		CSS: unknown;
		Event: typeof Event;
		document: Document;
		window: unknown;
	};

	/** Run a page function with jsdom globals (document/CSS/Event/window). */
	const withGlobals = async <T>(fn: () => T | Promise<T>): Promise<T> => {
		const keys = ["document", "CSS", "Event", "window"] as const;
		const prev = keys.map((k) => (globalThis as Record<string, unknown>)[k]);
		(globalThis as Record<string, unknown>)["document"] = view.document;
		(globalThis as Record<string, unknown>)["CSS"] = view.CSS;
		(globalThis as Record<string, unknown>)["Event"] = view.Event;
		(globalThis as Record<string, unknown>)["window"] = view.window ?? view;
		try {
			return await fn();
		} finally {
			keys.forEach((k, i) => {
				(globalThis as Record<string, unknown>)[k] = prev[i];
			});
		}
	};

	const query = (selector: string): Element[] =>
		Array.from(doc.querySelectorAll(selector));

	function makeLocator(selector: string, index: number | null): FakeLocator {
		const resolve = (): Element => {
			const els = query(selector);
			const el = index === null ? els[0] : els[index];
			if (!el) throw new Error(`locator resolved to no elements: ${selector}`);
			return el;
		};
		return {
			click: async () => {
				(resolve() as HTMLElement).click();
			},
			count: async () => query(selector).length,
			evaluate: async (fn) => withGlobals(() => fn(resolve())),
			fill: async (value) => {
				const el = resolve() as HTMLInputElement;
				el.focus();
				el.value = value;
				el.dispatchEvent(new view.Event("input", { bubbles: true }));
				el.dispatchEvent(new view.Event("change", { bubbles: true }));
			},
			first: () => makeLocator(selector, 0),
			getAttribute: async (name) => resolve().getAttribute(name),
			isVisible: async () => {
				try {
					return isVisibleEl(resolve());
				} catch {
					return false;
				}
			},
			nth: (i) => makeLocator(selector, i),
			scrollIntoViewIfNeeded: async () => {},
			waitFor: async (opts) => {
				const timeout = opts?.timeout ?? 5000;
				const deadline = Date.now() + timeout;
				for (;;) {
					try {
						if (isVisibleEl(resolve())) return;
					} catch {
						// Not attached yet — keep polling.
					}
					if (Date.now() >= deadline) {
						throw new Error(`waitFor timed out: ${selector}`);
					}
					await new Promise((r) => setTimeout(r, 25));
				}
			},
		};
	}

	return {
		evaluate: async (fn) => withGlobals(fn),
		locator: (selector) => makeLocator(selector, null),
		waitForTimeout: (ms) => new Promise((r) => setTimeout(r, ms)),
	};
}

const asPage = (fake: FakePage): Page => fake as unknown as Page;

/* ------------------------------------------------------------------ */
/* Vahan "Know Your Application Status" page emulation.                 */
/* ------------------------------------------------------------------ */

interface StatusPageOpts {
	/** Render only the Application Number option (negative case). */
	applicationOnly?: boolean;
	/** Extra unlabeled box alongside the application box (ambiguous page). */
	extraUnknownBox?: boolean;
	/** Never swap the panel, even when the radio changes (stuck page). */
	neverSwap?: boolean;
	/** Both radios inside one shared container (noisy container text). */
	sharedCell?: boolean;
	/**
	 * Single shared entry box labelled "Application No" (mirrors the live
	 * form: the mode radio decides what the value means, no panel swap).
	 */
	sharedEntryBox?: boolean;
	/** Start with Vehicle Number already selected and panel rendered. */
	startInVehicleMode?: boolean;
	/** Panel swap delay after checking Vehicle Number (AJAX emulation). */
	swapDelayMs?: number;
	/** Option text in plain spans instead of linked labels (box-only path). */
	unlinkedLabels?: boolean;
}

function buildStatusPage(opts: StatusPageOpts = {}): {
	doc: Document;
	fake: FakePage;
} {
	const dom = new JSDOM("<!doctype html><html><body></body></html>");
	const doc = dom.window.document;
	const inVehicleMode = opts.startInVehicleMode === true;

	const radiosHtml = opts.applicationOnly
		? `
			<div class="ui-radiobutton"><input type="radio" name="mode" id="modeAppl" value="A" checked><span class="ui-radiobutton-box"><span class="ui-radiobutton-icon"></span></span></div>
			<label for="modeAppl">Application Number</label>`
		: opts.unlinkedLabels
			? `
			<div class="opt"><div class="ui-radiobutton"><input type="radio" name="mode" id="modeAppl" value="A"${inVehicleMode ? "" : " checked"}><span class="ui-radiobutton-box"></span></div><span>Application Number</span></div>
			<div class="opt"><div class="ui-radiobutton"><input type="radio" name="mode" id="modeVeh" value="V"${inVehicleMode ? " checked" : ""}><span class="ui-radiobutton-box"></span></div><span>Vehicle Number</span></div>`
			: opts.sharedCell
				? `
			<td><div class="ui-radiobutton"><input type="radio" name="mode" id="modeAppl" value="A"${inVehicleMode ? "" : " checked"}><span class="ui-radiobutton-box"></span></div><label for="modeAppl">Application Number</label>
			<div class="ui-radiobutton"><input type="radio" name="mode" id="modeVeh" value="V"${inVehicleMode ? " checked" : ""}><span class="ui-radiobutton-box"></span></div><label for="modeVeh">Vehicle Number</label></td>`
				: `
			<div class="ui-radiobutton"><input type="radio" name="mode" id="modeAppl" value="A"${inVehicleMode ? "" : " checked"}><span class="ui-radiobutton-box"><span class="ui-radiobutton-icon"></span></span></div>
			<label for="modeAppl">Application Number</label>
			<div class="ui-radiobutton"><input type="radio" name="mode" id="modeVeh" value="V"${inVehicleMode ? " checked" : ""}><span class="ui-radiobutton-box"><span class="ui-radiobutton-icon"></span></span></div>
			<label for="modeVeh">Vehicle Number</label>`;

	doc.body.innerHTML = `
		<form id="statusForm">
			<div class="search-mode">${radiosHtml}</div>
			<div id="panel"></div>
			<label for="captchaIn">Security Code</label>
			<input type="text" id="captchaIn" name="captchaIn">
		</form>`;

	const panel = doc.querySelector("#panel") as HTMLElement;
	const renderPanel = (vehicle: boolean) => {
		if (opts.sharedEntryBox === true) {
			panel.innerHTML = `<label for="tf_entry">Application No</label><input type="text" id="tf_entry" name="tf_entry" maxlength="10">`;
			return;
		}
		panel.innerHTML = vehicle
			? `<label for="tf_regn_no">Registration No.</label><input type="text" id="tf_regn_no" name="tf_regn_no" maxlength="13">`
			: `<label for="tf_appl_no">Application Number</label><input type="text" id="tf_appl_no" name="tf_appl_no">${opts.extraUnknownBox === true ? `<label for="tf_extra">Enter Value</label><input type="text" id="tf_extra" name="tf_extra">` : ""}`;
	};
	renderPanel(opts.applicationOnly === true ? false : inVehicleMode);

	const checkOnly = (id: string) => {
		for (const r of Array.from(
			doc.querySelectorAll<HTMLInputElement>("input[type='radio']"),
		)) {
			r.checked = r.id === id;
		}
	};

	// Portal JS emulation: PrimeFaces-style box clicks only flip the
	// checked flag — like the real portal, a bare check does NOT fire the
	// AJAX panel swap. Only a `change` event (native label click or the
	// workflow's explicit kick) swaps the panel.
	for (const box of Array.from(doc.querySelectorAll(".ui-radiobutton-box"))) {
		box.addEventListener("click", () => {
			const wrap = box.closest(".ui-radiobutton, td, div");
			const input = wrap?.querySelector<HTMLInputElement>(
				"input[type='radio']",
			);
			if (!input) return;
			checkOnly(input.id);
		});
	}
	doc.addEventListener("change", (e) => {
		const target = e.target as HTMLInputElement;
		if (
			target?.id !== "modeVeh" ||
			opts.neverSwap === true ||
			opts.sharedEntryBox === true
		) {
			return;
		}
		const delay = opts.swapDelayMs ?? 0;
		setTimeout(() => renderPanel(true), delay);
	});

	return { doc, fake: makeFakePage(doc) };
}

afterEach(() => {
	delete (globalThis as Record<string, unknown>)["document"];
	delete (globalThis as Record<string, unknown>)["CSS"];
});

/* ------------------------------------------------------------------ */
/* Tests.                                                              */
/* ------------------------------------------------------------------ */

describe("vahan application-status search mode (jsdom)", () => {
	it("selects Vehicle Number and fills it after a delayed AJAX panel swap", {
		timeout: 30000,
	}, async () => {
		const { doc, fake } = buildStatusPage({ swapDelayMs: 800 });
		const page = asPage(fake);

		await selectVehicleNumberOption(page, 5000, noopLog);
		expect((doc.querySelector("#modeVeh") as HTMLInputElement).checked).toBe(
			true,
		);
		expect((doc.querySelector("#modeAppl") as HTMLInputElement).checked).toBe(
			false,
		);

		await fillVehicleNumber(page, VIN, 8000, noopLog);
		expect((doc.querySelector("#tf_regn_no") as HTMLInputElement).value).toBe(
			VIN,
		);
		// CAPTCHA box must stay untouched.
		expect((doc.querySelector("#captchaIn") as HTMLInputElement).value).toBe(
			"",
		);
	});

	it("works when Vehicle Number is already selected", {
		timeout: 30000,
	}, async () => {
		const { doc, fake } = buildStatusPage({ startInVehicleMode: true });
		const page = asPage(fake);

		await selectVehicleNumberOption(page, 5000, noopLog);
		await fillVehicleNumber(page, VIN, 8000, noopLog);
		expect((doc.querySelector("#tf_regn_no") as HTMLInputElement).value).toBe(
			VIN,
		);
	});

	it("selects Vehicle Number when both radios share one container", {
		timeout: 30000,
	}, async () => {
		const { doc, fake } = buildStatusPage({
			sharedCell: true,
			swapDelayMs: 300,
		});
		const page = asPage(fake);

		await selectVehicleNumberOption(page, 5000, noopLog);
		expect((doc.querySelector("#modeVeh") as HTMLInputElement).checked).toBe(
			true,
		);
		await fillVehicleNumber(page, VIN, 8000, noopLog);
		expect((doc.querySelector("#tf_regn_no") as HTMLInputElement).value).toBe(
			VIN,
		);
	});

	it("swaps the panel via change kick when labels are not linked", {
		timeout: 30000,
	}, async () => {
		// No <label for> exists, so the workflow must go through the box
		// click; the box alone does not swap the panel — only the explicit
		// change kick fires the update. This mirrors the live portal.
		const { doc, fake } = buildStatusPage({
			swapDelayMs: 300,
			unlinkedLabels: true,
		});
		const page = asPage(fake);

		await selectVehicleNumberOption(page, 5000, noopLog);
		expect((doc.querySelector("#modeVeh") as HTMLInputElement).checked).toBe(
			true,
		);
		await fillVehicleNumber(page, VIN, 8000, noopLog);
		expect((doc.querySelector("#tf_regn_no") as HTMLInputElement).value).toBe(
			VIN,
		);
		expect((doc.querySelector("#captchaIn") as HTMLInputElement).value).toBe(
			"",
		);
	});

	it("fails fast when no Vehicle Number option exists", {
		timeout: 30000,
	}, async () => {
		const { fake } = buildStatusPage({ applicationOnly: true });
		await expect(
			selectVehicleNumberOption(asPage(fake), 5000, noopLog),
		).rejects.toThrow(/Vehicle Number/);
	});

	it("fills the shared entry box when the panel never swaps", {
		timeout: 30000,
	}, async () => {
		// Mirrors the live form: one shared entry box, no panel swap — the
		// checked mode radio decides what the value means.
		const { doc, fake } = buildStatusPage({ sharedEntryBox: true });
		const page = asPage(fake);

		await selectVehicleNumberOption(page, 5000, noopLog);
		expect((doc.querySelector("#modeVeh") as HTMLInputElement).checked).toBe(
			true,
		);
		await fillVehicleNumber(page, VIN, 8000, noopLog);
		expect((doc.querySelector("#tf_entry") as HTMLInputElement).value).toBe(
			VIN,
		);
		expect((doc.querySelector("#captchaIn") as HTMLInputElement).value).toBe(
			"",
		);
	});

	it("refuses to fill when two ambiguous boxes are present", {
		timeout: 30000,
	}, async () => {
		const { doc, fake } = buildStatusPage({
			extraUnknownBox: true,
			neverSwap: true,
		});
		const page = asPage(fake);

		await selectVehicleNumberOption(page, 5000, noopLog);
		await expect(fillVehicleNumber(page, VIN, 3000, noopLog)).rejects.toThrow(
			/search field/,
		);
		expect((doc.querySelector("#tf_appl_no") as HTMLInputElement).value).toBe(
			"",
		);
		expect((doc.querySelector("#tf_extra") as HTMLInputElement).value).toBe("");
		expect((doc.querySelector("#captchaIn") as HTMLInputElement).value).toBe(
			"",
		);
	});
});
