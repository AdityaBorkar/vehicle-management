/**
 * Legacy artifact-key compat (server-only).
 *
 * Old rows stored absolute local paths; new rows store stable relative
 * keys served through the artifact store. Every download path
 * (`/api/pucc`, `/api/debug-artifact`, `debug.getArtifactUrl`) shares this
 * helper instead of copying the absolute-path fallback.
 */

import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { getArtifactStore } from "./artifact-store";

export async function readArtifactCompat(key: string): Promise<Buffer> {
	if (isAbsolute(key)) {
		try {
			return await readFile(key);
		} catch {
			// Fall through to the store lookup below.
		}
	}
	return getArtifactStore().read(key);
}
