import { describe, expect, it } from "vitest";

import { validateManualDocument } from "#/lib/manual-documents";

const BASE = {
	fileKey: "uploads/documents/MH01CR7464/goods_permit/2024-x-permit.pdf",
	fileMime: "application/pdf",
	fileSizeBytes: 1024,
	issueDate: new Date("2024-01-01"),
	vehicleId: 1,
};

describe("validateManualDocument", () => {
	it("accepts a valid goods_permit and speed_governor", () => {
		expect(
			validateManualDocument({ ...BASE, kind: "goods_permit" }),
		).toBeNull();
		expect(
			validateManualDocument({
				...BASE,
				fileKey: "uploads/documents/X/speed_governor/2024-x.pdf",
				kind: "speed_governor",
			}),
		).toBeNull();
	});

	it("rejects expiry on no-expiry kinds", () => {
		expect(
			validateManualDocument({
				...BASE,
				expiryDate: new Date("2025-01-01"),
				kind: "goods_permit",
			}),
		).toMatch(/no expiry/i);
		expect(
			validateManualDocument({
				...BASE,
				expiryDate: new Date("2025-01-01"),
				kind: "speed_governor",
			}),
		).toMatch(/no expiry/i);
	});

	it("requires valid-from and vehicle for all manual kinds", () => {
		const { issueDate: _issue, ...noIssue } = BASE;
		void _issue;
		expect(validateManualDocument({ ...noIssue, kind: "form20" })).toMatch(
			/Valid-from/i,
		);
		const { vehicleId: _v, ...noVehicle } = BASE;
		void _v;
		expect(
			validateManualDocument({ ...noVehicle, kind: "purchase_order" }),
		).toMatch(/Vehicle/i);
	});

	it("accepts optional expiry for purchase_order and form20", () => {
		expect(
			validateManualDocument({
				...BASE,
				expiryDate: new Date("2025-06-01"),
				kind: "purchase_order",
			}),
		).toBeNull();
		expect(validateManualDocument({ ...BASE, kind: "form20" })).toBeNull();
	});

	it("requires a file and validates mime/size/key", () => {
		const { fileKey: _k, ...noFile } = BASE;
		void _k;
		expect(validateManualDocument({ ...noFile, kind: "goods_permit" })).toMatch(
			/file/i,
		);
		expect(
			validateManualDocument({
				...BASE,
				fileMime: "application/zip",
				kind: "goods_permit",
			}),
		).toMatch(/PDF, JPEG or PNG/i);
		expect(
			validateManualDocument({
				...BASE,
				fileSizeBytes: 11 * 1024 * 1024,
				kind: "goods_permit",
			}),
		).toMatch(/10 MB/);
		expect(
			validateManualDocument({
				...BASE,
				fileKey: "pucc/X/a.pdf",
				kind: "goods_permit",
			}),
		).toMatch(/Invalid file key/);
	});

	it("ignores non-manual kinds", () => {
		expect(validateManualDocument({ kind: "insurance" })).toBeNull();
	});
});

describe("vault renew/archive cycle (Spec 05)", () => {
	it("goods_permit lifecycle: create -> renew (history) -> archive", async () => {
		const { getDocumentDisplayStatus } = await import("#/lib/document-status");
		// Create: valid manual doc passes validation, shows no-expiry.
		expect(
			validateManualDocument({ ...BASE, kind: "goods_permit" }),
		).toBeNull();
		expect(
			getDocumentDisplayStatus({
				expiryDate: null,
				isCurrent: true,
				kind: "goods_permit",
				status: "active",
			}),
		).toBe("no-expiry");
		// Renew must reject expiry on no-expiry kinds (server rule).
		expect(
			validateManualDocument({
				...BASE,
				expiryDate: new Date("2025-01-01"),
				kind: "goods_permit",
			}),
		).toMatch(/no expiry/i);
		// Renewed row stays active/no-expiry; old row becomes superseded (history).
		expect(
			getDocumentDisplayStatus({
				expiryDate: null,
				isCurrent: false,
				kind: "goods_permit",
				status: "superseded",
			}),
		).toBe("superseded");
		// Archive hides but preserves the row.
		expect(
			getDocumentDisplayStatus({
				expiryDate: null,
				isCurrent: false,
				kind: "goods_permit",
				status: "archived",
			}),
		).toBe("archived");
	});
});
