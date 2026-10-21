import { describe, expect, it } from "vitest";

import {
	getWorkflowDefinition,
	getWorkflowMetadata,
	listWorkflowDefinitions,
} from "#/browser-automation/engine";
import "#/browser-automation/workflows/pucc";
import { puccInputSchema } from "#/browser-automation/workflows/pucc";
import "#/browser-automation/workflows/vahan-transaction-history";
import { vahanTransactionHistoryInputSchema } from "#/browser-automation/workflows/vahan-transaction-history";

describe("workflow registry metadata (Spec 03)", () => {
	it("exposes both workflows with display metadata and fields", () => {
		const names = listWorkflowDefinitions();
		expect(names).toContain("pucc-fetch");
		expect(names).toContain("vahan-transaction-history");
		const meta = getWorkflowMetadata();
		const pucc = meta.find((m) => m.name === "pucc-fetch");
		expect(pucc?.displayName).toBeTruthy();
		expect(pucc?.fields.map((f) => f.name)).toContain("registrationNumber");
		expect(pucc?.fields.map((f) => f.name)).toContain("chassisLast5");
		const tx = meta.find((m) => m.name === "vahan-transaction-history");
		expect(tx?.fields.map((f) => f.name)).toContain("vehicleId");
	});

	it("resolves definitions with input schemas", () => {
		expect(getWorkflowDefinition("pucc-fetch")?.inputSchema).toBe(
			puccInputSchema,
		);
		expect(
			getWorkflowDefinition("vahan-transaction-history")?.inputSchema,
		).toBe(vahanTransactionHistoryInputSchema);
		expect(getWorkflowDefinition("nope")).toBeUndefined();
	});
});

describe("workflow input schemas", () => {
	it("pucc accepts valid input and rejects bad chassis", () => {
		expect(
			puccInputSchema.safeParse({
				chassisLast5: "12345",
				registrationNumber: "MH01CR7464",
			}).success,
		).toBe(true);
		expect(
			puccInputSchema.safeParse({
				chassisLast5: "12",
				registrationNumber: "MH01CR7464",
			}).success,
		).toBe(false);
		expect(puccInputSchema.safeParse({ chassisLast5: "12345" }).success).toBe(
			false,
		);
	});

	it("transaction-history requires a vehicle id", () => {
		expect(
			vahanTransactionHistoryInputSchema.safeParse({
				registrationNumber: "MH01CR7464",
				vehicleId: 1,
			}).success,
		).toBe(true);
		expect(
			vahanTransactionHistoryInputSchema.safeParse({
				registrationNumber: "MH01CR7464",
			}).success,
		).toBe(false);
	});
});

describe("workflow input hardening (Spec 03)", () => {
	it("rejects bad registration numbers server-side (never enqueues !!!)", () => {
		expect(
			puccInputSchema.safeParse({
				chassisLast5: "12345",
				registrationNumber: "!!!",
			}).success,
		).toBe(false);
		expect(
			vahanTransactionHistoryInputSchema.safeParse({
				registrationNumber: "!!!",
				vehicleId: 1,
			}).success,
		).toBe(false);
	});

	it("rejects bad chassis and missing vehicleId", () => {
		expect(
			puccInputSchema.safeParse({
				chassisLast5: "12",
				registrationNumber: "MH01CR7464",
			}).success,
		).toBe(false);
		expect(
			vahanTransactionHistoryInputSchema.safeParse({
				registrationNumber: "MH01CR7464",
			}).success,
		).toBe(false);
	});
});
