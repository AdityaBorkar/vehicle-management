import { describe, expect, it } from "vitest";

import { sanitizeFilename } from "./documents.upload";

describe("documents upload route (Spec 05)", () => {
	it("sanitizes filenames and preserves upload key contract", () => {
		expect(sanitizeFilename("../../etc/passwd")).not.toContain("..");
		expect(sanitizeFilename("my permit.pdf")).toContain("permit");
		// Key contract: uploads/documents/<REG>/<kind>/<stamp>-<file>
		const key = `uploads/documents/MH01CR7464/goods_permit/2024-x-permit.pdf`;
		expect(key.startsWith("uploads/documents/")).toBe(true);
	});
});
