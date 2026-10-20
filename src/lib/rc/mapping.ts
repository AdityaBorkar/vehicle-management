/**
 * Shared field-extraction helpers for RC provider payloads.
 *
 * Provider responses drift in key naming/casing (`maker` vs
 * `vehicle_manufacturer_name`, `fuel` vs `type`, ...), so lookups are
 * case-insensitive and accept key aliases. Unknown / missing fields stay
 * null — never throws on shape drift.
 */

export function pick(
	body: Record<string, unknown>,
	...keys: string[]
): unknown {
	const lower = new Map(
		Object.entries(body).map(([k, v]) => [k.toLowerCase(), v]),
	);
	for (const key of keys) {
		const hit = lower.get(key.toLowerCase());
		if (hit !== undefined && hit !== null && hit !== "") return hit;
	}
	return null;
}

/** Deeply pick across nested objects via dot paths, case-insensitive. */
export function pickNested(
	body: Record<string, unknown>,
	...paths: string[]
): unknown {
	for (const path of paths) {
		const segments = path.split(".");
		let current: unknown = body;
		let ok = true;
		for (const segment of segments) {
			if (
				typeof current !== "object" ||
				current === null ||
				Array.isArray(current)
			) {
				ok = false;
				break;
			}
			const lower = new Map(
				Object.entries(current as Record<string, unknown>).map(([k, v]) => [
					k.toLowerCase(),
					v,
				]),
			);
			const hit = lower.get(segment.toLowerCase());
			if (hit === undefined || hit === null || hit === "") {
				ok = false;
				break;
			}
			current = hit;
		}
		if (ok) return current;
	}
	return null;
}

export function asText(value: unknown): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return null;
}

const MONTHS: Record<string, string> = {
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

/** Normalize provider dates (ISO, `DD/MM/YYYY`, `DD-Mon-YYYY`, ...) to `YYYY-MM-DD`. */
export function parseApiDate(value: unknown): string | null {
	const text = asText(value);
	if (!text) return null;
	const first = (text.trim().split(" ")[0] ?? "").split("T")[0] ?? "";
	if (/^\d{4}-\d{2}-\d{2}$/.test(first)) return first;
	// MM/YYYY (Cashfree `vehicle_manufacturing_month_year`) -> YYYY-MM-01.
	const monthYear = first.match(/^(\d{1,2})[/-](\d{4})$/);
	if (monthYear) {
		const month = (monthYear[1] ?? "").padStart(2, "0");
		const year = monthYear[2] ?? "";
		const monthNum = Number(month);
		if (monthNum >= 1 && monthNum <= 12) {
			return `${year}-${month}-01`;
		}
		return null;
	}
	const m = first.match(/^(\d{1,2})[-/](\d{1,2}|[A-Za-z]{3})[-/](\d{2,4})$/);
	if (m) {
		let month = m[2] ?? "";
		if (/[A-Za-z]/.test(month)) {
			month = MONTHS[month.toLowerCase().slice(0, 3)] ?? "";
		} else {
			month = month.padStart(2, "0");
		}
		if (!month) return null;
		let year = m[3] ?? "";
		if (year.length === 2) year = `20${year}`;
		const day = (m[1] ?? "").padStart(2, "0");
		const iso = `${year}-${month}-${day}`;
		if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso))) {
			return iso;
		}
		return null;
	}
	const parsed = Date.parse(first);
	if (!Number.isNaN(parsed)) {
		return new Date(parsed).toISOString().slice(0, 10);
	}
	return null;
}

export function parseApiYear(value: unknown): number | null {
	const text = asText(value);
	if (!text) return null;
	const m = text.match(/(19|20)\d{2}/);
	if (!m) return null;
	const year = Number(m[0]);
	return year >= 1900 && year <= 2100 ? year : null;
}
