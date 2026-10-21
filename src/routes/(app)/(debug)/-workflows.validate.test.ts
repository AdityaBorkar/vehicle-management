import { describe, expect, it } from "vitest";

import { validateField } from "./workflows";

const regField = {
	label: "Registration number",
	name: "registrationNumber",
	required: true,
	type: "registrationNumber",
};

const chassisField = {
	label: "Chassis last 5 chars",
	name: "chassisLast5",
	required: true,
	type: "chassisLast5",
};

const vehicleField = {
	label: "Vehicle ID",
	name: "vehicleId",
	required: false,
	type: "vehicleId",
};

describe("generic workflow form renderer (Spec 03 smoke)", () => {
	it("rejects invalid registration client-side AND server-side", async () => {
		expect(validateField("pucc-fetch", regField, "!!!")).toMatch(
			/Invalid registration/,
		);
		expect(validateField("pucc-fetch", regField, "MH01CR7464")).toBeNull();
		const { puccInputSchema } = await import(
			"#/browser-automation/workflows/pucc"
		);
		expect(
			puccInputSchema.safeParse({
				chassisLast5: "12345",
				registrationNumber: "!!!",
			}).success,
		).toBe(false);
	});

	it("rejects bad chassis and non-numeric vehicleId", () => {
		expect(validateField("pucc-fetch", chassisField, "12")).toMatch(
			/5 characters/,
		);
		expect(validateField("pucc-fetch", chassisField, "12345")).toBeNull();
		expect(validateField("pucc-fetch", vehicleField, "abc")).toMatch(/numeric/);
		expect(validateField("pucc-fetch", vehicleField, "")).toBeNull();
	});
});
