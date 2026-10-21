import { describe, expect, it } from "vitest";

import { deriveChassisLast5, puccArtifactUrl } from "#/lib/pucc";

describe("deriveChassisLast5", () => {
	it("takes the last 5 of a full VIN", () => {
		expect(deriveChassisLast5("MAT505227K8B04198")).toBe("04198");
	});

	it("normalizes separators and case", () => {
		expect(deriveChassisLast5("mat 505227k8b-04198")).toBe("04198");
	});

	it("returns null when unusable", () => {
		expect(deriveChassisLast5(null)).toBeNull();
		expect(deriveChassisLast5("")).toBeNull();
		expect(deriveChassisLast5("1234")).toBeNull();
		expect(deriveChassisLast5("12 34!")).toBeNull();
	});
});

describe("puccArtifactUrl", () => {
	it("points at the artifact route", () => {
		expect(puccArtifactUrl(7)).toBe("/api/pucc/7");
	});
});
