import { describe, expect, it } from "vitest";

import { cleanCaptchaText } from "#/browser-automation/captcha";
import {
	normalizeChassisLast5,
	normalizePuccRegistrationNumber,
} from "#/browser-automation/workflows/pucc";

describe("pucc input normalization", () => {
	it("normalizes registration numbers", () => {
		expect(normalizePuccRegistrationNumber("mh 01-cr 7464")).toBe("MH01CR7464");
	});

	it("rejects bad registration numbers", () => {
		expect(() => normalizePuccRegistrationNumber("!!!")).toThrow();
		expect(() => normalizePuccRegistrationNumber("MH01")).toThrow();
	});

	it("requires exactly 5 chassis chars", () => {
		expect(normalizeChassisLast5(" 12a45 ")).toBe("12A45");
		expect(() => normalizeChassisLast5("1234")).toThrow();
		expect(() => normalizeChassisLast5("123456")).toThrow();
		expect(() => normalizeChassisLast5("12 34!")).toThrow();
	});
});

describe("captcha cleaning", () => {
	it("strips noise down to the code", () => {
		expect(cleanCaptchaText("  aB12c3 \n")).toBe("aB12c3");
		expect(cleanCaptchaText('"X7-9K2" is the code')).toBe(
			"X79K2isthecode".slice(0, 12),
		);
		expect(cleanCaptchaText("")).toBe("");
	});
});
