/**
 * Vahan transaction-history table + detail extraction.
 *
 * Pure mapping (column aliases, date parsing, record building) plus the
 * portal-table scraping that picks the most application-like table on the
 * result page. No navigation or CAPTCHA logic here.
 */

import type { Page } from "patchright";

import { parseApiDate } from "#/lib/rc/mapping";

export interface VahanTransactionRecord {
	applicationNumber?: string | null;
	raw: Record<string, string>;
	remarks?: string | null;
	serviceType?: string | null;
	status?: string | null;
	transactionDate?: string | null;
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
	// Same normalization as every other RC date (`DD-MM-YYYY`,
	// `DD-Mon-YYYY`, ISO, ...); unparseable input passes through so the
	// raw portal text is never lost.
	return parseApiDate(value) ?? value;
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

export async function extractSummaryPairs(
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

export async function extractTransactionRows(
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

export function hasResultContent(
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
