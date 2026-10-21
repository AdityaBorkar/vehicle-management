import { describe, expect, it } from "vitest";

import { getDocumentDisplayStatus } from "#/lib/document-status";

const BASE = {
	isCurrent: true,
	kind: "insurance",
	status: "active",
};

describe("getDocumentDisplayStatus (Spec 05)", () => {
	it("excludes purchase_order with expiry from overdue", () => {
		const future = new Date(Date.now() + 365 * 24 * 3600 * 1000);
		const past = new Date(Date.now() - 10 * 24 * 3600 * 1000);
		expect(
			getDocumentDisplayStatus({
				...BASE,
				expiryDate: future,
				kind: "purchase_order",
			}),
		).toBe("valid");
		expect(
			getDocumentDisplayStatus({
				...BASE,
				expiryDate: past,
				kind: "purchase_order",
			}),
		).toBe("valid");
		expect(
			getDocumentDisplayStatus({
				...BASE,
				expiryDate: null,
				kind: "purchase_order",
			}),
		).toBe("no-expiry");
	});

	it("flags expired/expiring/valid for dated kinds", () => {
		const past = new Date(Date.now() - 24 * 3600 * 1000);
		const soon = new Date(Date.now() + 10 * 24 * 3600 * 1000);
		const later = new Date(Date.now() + 100 * 24 * 3600 * 1000);
		expect(getDocumentDisplayStatus({ ...BASE, expiryDate: past })).toBe(
			"expired",
		);
		expect(getDocumentDisplayStatus({ ...BASE, expiryDate: soon })).toBe(
			"expiring",
		);
		expect(getDocumentDisplayStatus({ ...BASE, expiryDate: later })).toBe(
			"valid",
		);
	});

	it("shows no-expiry for null expiry and history for superseded/archived", () => {
		expect(
			getDocumentDisplayStatus({
				...BASE,
				expiryDate: null,
				kind: "goods_permit",
			}),
		).toBe("no-expiry");
		expect(
			getDocumentDisplayStatus({ ...BASE, expiryDate: null, isCurrent: false }),
		).toBe("superseded");
		expect(
			getDocumentDisplayStatus({
				...BASE,
				expiryDate: null,
				status: "archived",
			}),
		).toBe("archived");
	});

	it("form20 with expiry follows standard rules", () => {
		const past = new Date(Date.now() - 5 * 24 * 3600 * 1000);
		expect(
			getDocumentDisplayStatus({ ...BASE, expiryDate: past, kind: "form20" }),
		).toBe("expired");
	});
});
