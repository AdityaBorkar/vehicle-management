/**
 * One-shot migration: upload `.local/artifacts/**` to RustFS preserving keys.
 *
 * Usage: `bun scripts/migrate-artifacts-to-rustfs.ts [--dry-run]`
 * Idempotent: skips keys that already exist in the store.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

import {
	contentTypeForKey,
	getArtifactStore,
	resolveArtifactDir,
} from "../src/browser-automation/artifact-store.ts";

function listFiles(dir: string): string[] {
	let out: string[] = [];
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return out;
	}
	for (const e of entries) {
		const full = join(dir, e);
		try {
			if (statSync(full).isDirectory()) out = out.concat(listFiles(full));
			else out.push(full);
		} catch {
			// skip unreadable entries
		}
	}
	return out;
}

async function main(): Promise<void> {
	const dryRun = process.argv.includes("--dry-run");
	const baseDir = resolveArtifactDir();
	const files = listFiles(baseDir);
	console.log(
		`[migrate] base=${baseDir} files=${files.length} dryRun=${dryRun}`,
	);
	if (files.length === 0) return;
	const store = getArtifactStore();
	let uploaded = 0;
	let skipped = 0;
	for (const full of files) {
		const key = relative(baseDir, full).split("\\").join("/");
		const exists = (await store.exists?.(key)) ?? false;
		if (exists) {
			skipped++;
			continue;
		}
		if (dryRun) {
			console.log(`[migrate] would upload ${key}`);
			continue;
		}
		const data = readFileSync(full);
		await store.save(key, data, { contentType: contentTypeForKey(key) });
		uploaded++;
		if (uploaded % 25 === 0) console.log(`[migrate] uploaded ${uploaded}...`);
	}
	console.log(`[migrate] done uploaded=${uploaded} skipped=${skipped}`);
}

void main().catch((err) => {
	console.error("[migrate] failed:", err);
	process.exit(1);
});
