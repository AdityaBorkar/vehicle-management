import { describe, expect, it } from "vitest";

import {
	cleanCaptchaText,
	parseCaptchaSolution,
} from "#/browser-automation/captcha";

describe("parseCaptchaSolution", () => {
	it("parses the {code, confidence} JSON contract", () => {
		expect(
			parseCaptchaSolution('{"code": "s9BaWx", "confidence": 0.95}'),
		).toEqual({
			code: "s9BaWx",
			confidence: 0.95,
			raw: '{"code": "s9BaWx", "confidence": 0.95}',
		});
	});

	it("tolerates markdown fences", () => {
		expect(
			parseCaptchaSolution('```json\n{"code": "ab12", "confidence": 0.7}\n```'),
		).toMatchObject({ code: "ab12", confidence: 0.7 });
	});

	it("cleans the code and rejects empties", () => {
		expect(
			parseCaptchaSolution('{"code": "a b-12", "confidence": 1}').code,
		).toBe("ab12");
		expect(() =>
			parseCaptchaSolution('{"code": "---", "confidence": 0.5}'),
		).toThrow(/empty CAPTCHA code/);
	});

	it("rejects non-JSON and off-schema answers", () => {
		expect(() => parseCaptchaSolution("s9BaWx")).toThrow(/not JSON/);
		expect(() => parseCaptchaSolution('{"code": "abc"}')).toThrow(/schema/);
		expect(() =>
			parseCaptchaSolution('{"code": "abc", "confidence": 2}'),
		).toThrow(/schema/);
	});
});

describe("cleanCaptchaText", () => {
	it("strips noise down to the code", () => {
		expect(cleanCaptchaText("  aB12c3 \n")).toBe("aB12c3");
		expect(cleanCaptchaText("")).toBe("");
	});
});
