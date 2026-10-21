import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	bucketForKey,
	contentTypeForKey,
	createArtifactStore,
	isDocumentKey,
	isS3ArtifactStoreConfigured,
	resolveRustfsConfig,
	sanitizeRelative,
} from "#/browser-automation/artifact-store";

describe("sanitizeRelative", () => {
	it("rejects traversal and empty paths", () => {
		expect(sanitizeRelative("pucc/REG/a.pdf")).toBe("pucc/REG/a.pdf");
		// ".." segments are neutralized to "artifact" so the key can never
		// escape the store root.
		const traversed = sanitizeRelative("../../etc/passwd");
		expect(traversed).not.toContain("..");
		expect(traversed).toBe("artifact/artifact/etc/passwd");
		expect(sanitizeRelative("")).toBe("artifact");
	});
});

describe("contentTypeForKey", () => {
	it("maps known extensions", () => {
		expect(contentTypeForKey("a.pdf")).toBe("application/pdf");
		expect(contentTypeForKey("debug/1/recording.webm")).toBe("video/webm");
		expect(contentTypeForKey("x.png")).toBe("image/png");
		expect(contentTypeForKey("x.jpg")).toBe("image/jpeg");
		expect(contentTypeForKey("debug/1/console.log")).toBe("text/plain");
		expect(contentTypeForKey("x.bin")).toBe("application/octet-stream");
	});
});

describe("isDocumentKey / bucketForKey", () => {
	it("routes document uploads to the documents bucket", () => {
		expect(isDocumentKey("uploads/documents/REG/po/a.pdf")).toBe(true);
		expect(isDocumentKey("pucc/REG/a.pdf")).toBe(false);
		const cfg = { bucketArtifacts: "artifacts", bucketDocuments: "documents" };
		expect(bucketForKey("uploads/documents/a.pdf", cfg)).toBe("documents");
		expect(bucketForKey("pucc/a.pdf", cfg)).toBe("artifacts");
	});
});

describe("resolveRustfsConfig", () => {
	it("is null without an endpoint and honors env", () => {
		const prev = process.env.RUSTFS_ENDPOINT;
		delete process.env.RUSTFS_ENDPOINT;
		expect(resolveRustfsConfig()).toBeNull();
		expect(isS3ArtifactStoreConfigured()).toBe(false);
		process.env.RUSTFS_ENDPOINT = "http://localhost:9000/";
		expect(resolveRustfsConfig()?.endpoint).toBe("http://localhost:9000");
		expect(isS3ArtifactStoreConfigured()).toBe(true);
		if (prev === undefined) delete process.env.RUSTFS_ENDPOINT;
		else process.env.RUSTFS_ENDPOINT = prev;
	});
});

describe("local artifact store (round-trip + traversal guard)", () => {
	it("saves and reads back with content type", async () => {
		const base = mkdtempSync(join(tmpdir(), "artifacts-"));
		const store = createArtifactStore(base);
		const saved = await store.save("debug/1/console.log", Buffer.from("hi"), {
			contentType: "text/plain",
		});
		expect(saved.relativePath).toBe("debug/1/console.log");
		expect(saved.contentType).toBe("text/plain");
		expect(saved.sizeBytes).toBe(2);
		const back = await store.read("debug/1/console.log");
		expect(back.toString()).toBe("hi");
		expect(await store.exists?.("debug/1/console.log")).toBe(true);
		expect(await store.exists?.("debug/1/missing.log")).toBe(false);
	});

	it("rejects reads outside the base dir", async () => {
		const base = mkdtempSync(join(tmpdir(), "artifacts-"));
		const store = createArtifactStore(base);
		// sanitizeRelative neutralizes traversal, so the read targets a
		// non-existent file inside the store instead of escaping it.
		await expect(store.read("../../etc/passwd")).rejects.toThrow();
	});
});

describe("ArtifactStore interface + presigned URLs", () => {
	it("exposes getPresignedUrl on the S3 backend", async () => {
		const { createS3ArtifactStore, getArtifactStore, resetArtifactStore } =
			await import("#/browser-automation/artifact-store");
		const store = createS3ArtifactStore({
			accessKey: "test",
			bucketArtifacts: "artifacts",
			bucketDocuments: "documents",
			endpoint: "http://localhost:9000",
			region: "us-east-1",
			secretKey: "test",
		});
		if (typeof store.getPresignedUrl !== "function") {
			throw new Error("S3 store must expose getPresignedUrl");
		}
		const url = await store.getPresignedUrl("pucc/REG/a.pdf", 60);
		expect(typeof url).toBe("string");
		// Presigned URL is bucket-addressed (path-style) for the artifacts bucket.
		expect(url).toContain("artifacts");
		// Local fallback has no presigned support — serve via auth proxy.
		resetArtifactStore();
		const prev = process.env.RUSTFS_ENDPOINT;
		delete process.env.RUSTFS_ENDPOINT;
		resetArtifactStore();
		const local = getArtifactStore();
		await expect(local.getPresignedUrl?.("pucc/REG/a.pdf")).rejects.toThrow(
			/presigned/i,
		);
		if (prev === undefined) delete process.env.RUSTFS_ENDPOINT;
		else process.env.RUSTFS_ENDPOINT = prev;
		resetArtifactStore();
		void getArtifactStore;
	});
});
