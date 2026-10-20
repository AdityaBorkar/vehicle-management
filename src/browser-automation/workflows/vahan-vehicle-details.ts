import type { Page } from "patchright";

import { normalizeRegistrationNumber, vahanLogin } from "./vahan-login";

export const VAHAN_VEHICLE_DETAILS_WORKFLOW_NAME =
	"vahan-vehicle-details" as const;

/** NR e-Services "Know Your Vehicle Details" entry point. */
export const VAHAN_KNOWN_VEHICLE_DETAILS_URL =
	"https://vahan.parivahan.gov.in/nrservices/faces/user/citizen/citizenlogin.xhtml";

const DEFAULT_TIMEOUT_MS = 45_000;

export interface VahanVehicleDetailsInput {
	registrationNumber: string;
	timeoutMs?: number;
}

export interface VahanVehicleDetails {
	chassisNumber?: string | null;
	color?: string | null;
	engineNumber?: string | null;
	fitnessValidTill?: string | null;
	fuelType?: string | null;
	insuranceValidTill?: string | null;
	make?: string | null;
	model?: string | null;
	ownerName?: string | null;
	pollutionValidTill?: string | null;
	raw: Record<string, string>;
	registrationDate?: string | null;
	registrationNumber: string;
	vehicleClass?: string | null;
	year?: number | null;
}

const LABEL_ALIASES: Record<string, string[]> = {
	chassisNumber: ["chassis no", "chassis number", "chasis no"],
	color: ["colour", "color"],
	engineNumber: ["engine no", "engine number"],
	fitnessValidTill: [
		"fitness valid",
		"fitness up to",
		"fitness validity",
		"fit up to",
	],
	fuelType: ["fuel", "fuel type"],
	insuranceValidTill: [
		"insurance valid",
		"insurance up to",
		"insurance validity",
		"ins. up to",
	],
	make: ["maker", "manufacturer", "make"],
	model: ["model", "model name", "variant"],
	ownerName: ["owner name", "registered owner", "owner"],
	pollutionValidTill: [
		"puc valid",
		"pucc up to",
		"pollution up to",
		"emission valid",
		"puc up to",
	],
	registrationDate: [
		"registration date",
		"regn. date",
		"reg. date",
		"reg date",
	],
	vehicleClass: ["vehicle class", "class"],
	year: ["manufacture year", "mfg year", "year of manufacture", "model year"],
};

function cleanText(value: string): string {
	return value
		.replace(/\s+/g, " ")
		.replace(/[:\-–—]+$/, "")
		.trim();
}

function findField(
	raw: Record<string, string>,
	key: keyof typeof LABEL_ALIASES,
): string | null {
	const aliases = LABEL_ALIASES[key] ?? [];
	const entries = Object.entries(raw);
	for (const alias of aliases) {
		const hit = entries.find(([label]) => label.toLowerCase().includes(alias));
		if (hit?.[1]) return cleanText(hit[1]);
	}
	return null;
}

export function parseVahanDate(value: string | null): string | null {
	if (!value) return null;
	const text = value.trim().split(" ")[0] ?? "";
	const m = text.match(/^(\d{1,2})[-/](\d{1,2}|[A-Za-z]{3})[-/](\d{2,4})$/);
	if (!m) {
		const iso = Date.parse(text);
		if (Number.isNaN(iso)) return null;
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
	if (!month) return null;
	let year = y ?? "";
	if (year.length === 2) year = `20${year}`;
	const day = (d ?? "").padStart(2, "0");
	if (!/^\d{4}-\d{2}-\d{2}$/.test(`${year}-${month}-${day}`)) return null;
	return `${year}-${month}-${day}`;
}

function parseYear(value: string | null): number | null {
	if (!value) return null;
	const m = value.match(/(19|20)\d{2}/);
	if (!m) return null;
	const year = Number(m[0]);
	if (year < 1900 || year > 2100) return null;
	return year;
}

export function mapRawToVehicleDetails(
	registrationNumber: string,
	raw: Record<string, string>,
): VahanVehicleDetails {
	const registrationDate = parseVahanDate(findField(raw, "registrationDate"));
	const fitnessValidTill = parseVahanDate(findField(raw, "fitnessValidTill"));
	const insuranceValidTill = parseVahanDate(
		findField(raw, "insuranceValidTill"),
	);
	const pollutionValidTill = parseVahanDate(
		findField(raw, "pollutionValidTill"),
	);
	const yearRaw = findField(raw, "year");
	const year =
		parseYear(yearRaw) ??
		(registrationDate ? Number(registrationDate.slice(0, 4)) : null);

	return {
		chassisNumber: findField(raw, "chassisNumber"),
		color: findField(raw, "color"),
		engineNumber: findField(raw, "engineNumber"),
		fitnessValidTill,
		fuelType: findField(raw, "fuelType"),
		insuranceValidTill,
		make: findField(raw, "make"),
		model: findField(raw, "model"),
		ownerName: findField(raw, "ownerName"),
		pollutionValidTill,
		raw,
		registrationDate,
		registrationNumber,
		vehicleClass: findField(raw, "vehicleClass"),
		year,
	};
}

async function extractLabelValuePairs(
	page: Page,
): Promise<Record<string, string>> {
	return page.evaluate(() => {
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

		document.querySelectorAll("dl").forEach((dl) => {
			const dts = Array.from(dl.querySelectorAll("dt"));
			dts.forEach((dt) => {
				const dd = dt.nextElementSibling;
				if (dd && dd.tagName.toLowerCase() === "dd") {
					push(dt.textContent ?? "", dd.textContent ?? "");
				}
			});
		});

		document
			.querySelectorAll("[class*='detail'], [class*='info'], [class*='rc']")
			.forEach((el) => {
				const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
				const m = text.match(/^([^:]{2,60}):\s*(.+)$/);
				if (m?.[1] && m?.[2] && m[2].length < 200) push(m[1], m[2]);
			});

		return out;
	});
}

function hasCaptcha(page: Page): Promise<boolean> {
	return page
		.evaluate(() =>
			Boolean(
				document.querySelector(
					"img[id*='captcha' i], img[src*='captcha' i], canvas[id*='captcha' i]",
				),
			),
		)
		.catch(() => false);
}

async function tryVahanServiceDetails(
	page: Page,
	timeoutMs: number,
): Promise<Record<string, string>> {
	const candidates = [
		"a:has-text('Know Your Vehicle Details')",
		"a:has-text('Know your Vehicle Details')",
		"a:has-text('Vehicle Details')",
		"a:has-text('RC ') ",
		"a:has-text('Status')",
	];
	for (const selector of candidates) {
		const link = page.locator(selector).first();
		try {
			await link.waitFor({ state: "visible", timeout: 4000 });
			await link.click({ timeout: timeoutMs });
			await page
				.waitForLoadState("networkidle", { timeout: timeoutMs })
				.catch(() => {});
			const raw = await extractLabelValuePairs(page);
			if (Object.keys(raw).length > 0) return raw;
		} catch {}
	}
	return extractLabelValuePairs(page);
}

/**
 * Full autofill workflow for Add Vehicle.
 *
 * 1. Runs the shared vahanservice login (registration number + Proceed x2).
 * 2. Follows any "Know Your Vehicle Details" / Status / RC link found.
 * 3. Extracts label/value pairs generically and maps them to vehicle fields.
 *
 * Throws a CAPTCHA error when the details page is captcha-gated so the
 * caller can surface "needs manual refresh" instead of saving partial data.
 */
export async function vahanVehicleDetails(
	page: Page,
	input: VahanVehicleDetailsInput,
): Promise<VahanVehicleDetails> {
	const registrationNumber = normalizeRegistrationNumber(
		input.registrationNumber,
	);
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	await vahanLogin(page, { registrationNumber, timeoutMs });

	const raw = await tryVahanServiceDetails(page, timeoutMs);

	if (Object.keys(raw).length === 0 && (await hasCaptcha(page))) {
		throw new Error(
			`Vahan details for "${registrationNumber}" are behind a CAPTCHA. Refresh manually and retry.`,
		);
	}

	if (Object.keys(raw).length === 0) {
		throw new Error(
			`No vehicle details found on Vahan for "${registrationNumber}". Selectors may have changed — check the debug workflows page.`,
		);
	}

	return mapRawToVehicleDetails(registrationNumber, raw);
}
