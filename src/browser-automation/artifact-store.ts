/**
 * Server-only artifact store.
 *
 * PUCC PDFs (and future workflow outputs) are written through this
 * interface so the filesystem layout can later be swapped for S3 without
 * touching workflow code: implement `ArtifactStore` with an S3 backend and
 * replace the `artifactStore` singleton.
 *
 * Never import this module from client components — it uses `node:fs`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface SavedArtifact {
	/** Absolute path on server FS. */
	absolutePath: string;
	/** Path relative to the artifact root (stable for DB storage). */
	relativePath: string;
}

export interface ArtifactStore {
	read(relativePath: string): Promise<Buffer>;
	save(relativePath: string, data: Buffer | Uint8Array): Promise<SavedArtifact>;
}

export function resolveArtifactDir(): string {
	const configured = process.env.ARTIFACT_DIR?.trim();
	if (configured) return resolve(configured);
	return resolve(process.cwd(), ".local", "artifacts");
}

function sanitizeSegment(segment: string): string {
	const cleaned = segment.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
	const trimmed = cleaned.replace(/^[-.]+|[-.]+$/g, "");
	return trimmed || "artifact";
}

class LocalArtifactStore implements ArtifactStore {
	readonly baseDir: string;

	constructor(baseDir?: string) {
		this.baseDir = baseDir ?? resolveArtifactDir();
	}

	async read(relativePath: string): Promise<Buffer> {
		const absolutePath = this.resolve(relativePath);
		return readFileSync(absolutePath);
	}

	async save(
		relativePath: string,
		data: Buffer | Uint8Array,
	): Promise<SavedArtifact> {
		const safeRelative = sanitizeRelative(relativePath);
		const absolutePath = join(this.baseDir, safeRelative);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, data);
		return { absolutePath, relativePath: safeRelative };
	}

	/** Resolve a stored relative path, guarding against traversal. */
	resolve(relativePath: string): string {
		const safeRelative = sanitizeRelative(relativePath);
		const absolutePath = join(this.baseDir, safeRelative);
		const base = `${this.baseDir}${"/"}`;
		if (!absolutePath.startsWith(base)) {
			throw new Error(`Artifact path escapes the store: "${relativePath}".`);
		}
		return absolutePath;
	}
}

function sanitizeRelative(relativePath: string): string {
	const segments = relativePath
		.split("/")
		.map((s) => sanitizeSegment(s))
		.filter(Boolean);
	const safeRelative = segments.join("/");
	if (!safeRelative) throw new Error("Empty artifact path.");
	return safeRelative;
}

export const artifactStore = new LocalArtifactStore();

export function createArtifactStore(baseDir: string): ArtifactStore {
	return new LocalArtifactStore(baseDir);
}
