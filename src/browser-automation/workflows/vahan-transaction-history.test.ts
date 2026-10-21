import { describe, expect, it } from "vitest";

import {
	classifyField,
	isApplicationNumberDescriptor,
	isCaptchaLikeDescriptor,
	isVehicleNumberDescriptor,
	normalizeRegistrationNumber,
	parseTxDate,
	toTransactionRecord,
} from "#/browser-automation/workflows/vahan-transaction-history";

describe("transaction-history input normalization", () => {
	it("normalizes registration numbers", () => {
		expect(normalizeRegistrationNumber("mh 01-cr 7464")).toBe("MH01CR7464");
	});

	it("rejects bad registration numbers", () => {
		expect(() => normalizeRegistrationNumber("!!!")).toThrow();
		expect(() => normalizeRegistrationNumber("MH01")).toThrow();
	});
});

describe("transaction-history search-mode descriptors", () => {
	it("recognizes vehicle-number options", () => {
		expect(isVehicleNumberDescriptor("Vehicle Number")).toBe(true);
		expect(isVehicleNumberDescriptor("Vehicle No.")).toBe(true);
		expect(isVehicleNumberDescriptor("Registration No")).toBe(true);
		expect(isVehicleNumberDescriptor("regn_no | Regn No")).toBe(true);
	});

	it("rejects application-number options as vehicle mode", () => {
		expect(isVehicleNumberDescriptor("Application Number")).toBe(false);
		expect(isVehicleNumberDescriptor("Application No")).toBe(false);
		expect(isVehicleNumberDescriptor("Receipt No")).toBe(false);
	});

	it("recognizes application-number options", () => {
		expect(isApplicationNumberDescriptor("Application Number")).toBe(true);
		expect(isApplicationNumberDescriptor("Appln No")).toBe(true);
		expect(isApplicationNumberDescriptor("Vehicle Number")).toBe(false);
	});

	it("matches camelCase ids like the portal uses", () => {
		expect(isVehicleNumberDescriptor("tf_regn_no")).toBe(true);
		expect(isCaptchaLikeDescriptor("captchaIn")).toBe(true);
		expect(isCaptchaLikeDescriptor("Security Code")).toBe(true);
		expect(isCaptchaLikeDescriptor("tfRegnNo")).toBe(false);
		expect(isVehicleNumberDescriptor("tfRegnNo")).toBe(true);
	});

	it("classifies fields with container noise correctly", () => {
		// Input sitting next to both search-mode labels: unknown, never
		// "application" by container text alone.
		expect(classifyField("", "Application Number | Vehicle Number")).toBe(
			"unknown",
		);
		expect(classifyField("tf_regn_no", "tf_regn_no | Registration No.")).toBe(
			"vehicle",
		);
		expect(classifyField("tf_appl_no", "tf_appl_no | Application Number")).toBe(
			"application",
		);
		expect(classifyField("captchaIn", "captchaIn | Security Code")).toBe(
			"captcha",
		);
	});
});

describe("transaction-history date parsing", () => {
	it("parses dd-mm-yyyy", () => {
		expect(parseTxDate("05-08-2024")).toBe("2024-08-05");
	});

	it("parses dd-Mon-yyyy", () => {
		expect(parseTxDate("05-Aug-2024")).toBe("2024-08-05");
	});

	it("passes through null", () => {
		expect(parseTxDate(null)).toBeNull();
	});
});

describe("transaction-history row mapping", () => {
	it("maps portal columns to records", () => {
		const record = toTransactionRecord({
			"Application No.": "MH2401012345678",
			Date: "05-08-2024",
			Status: "Approved",
			"Transaction / Service": "Transfer of Ownership",
		});
		expect(record?.applicationNumber).toBe("MH2401012345678");
		expect(record?.serviceType).toBe("Transfer of Ownership");
		expect(record?.status).toBe("Approved");
		expect(record?.transactionDate).toBe("2024-08-05");
	});

	it("returns null for empty rows", () => {
		expect(toTransactionRecord({})).toBeNull();
		expect(toTransactionRecord({ "": "" })).toBeNull();
	});
});
