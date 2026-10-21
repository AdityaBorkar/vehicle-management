import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createArtifactStore } from "#/browser-automation/artifact-store";

describe("local artifact store", () => {
	it("saves buffers under the base dir", async () => {
		const base = mkdtempSync(join(tmpdir(), "artifacts-"));
		const store = createArtifactStore(base);
		const saved = await store.save(
			"pucc/REG/test-pucc.pdf",
			Buffer.from("%PDF-1.4"),
		);
		expect(saved.relativePath).toBe("pucc/REG/test-pucc.pdf");
		expect(saved.absolutePath.startsWith(base)).toBe(true);
		expect(readFileSync(saved.absolutePath).toString()).toBe("%PDF-1.4");
	});
});
