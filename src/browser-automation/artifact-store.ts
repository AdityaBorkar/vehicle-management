/**
 * Server-only artifact store.
 *
 * PUCC PDFs, debug videos/screenshots/logs (Spec 02) and user-uploaded
 * documents (Spec 05) are written through this interface. Two backends:
 * - Local filesystem (`$ARTIFACT_DIR` or `.local/artifacts`) — dev fallback / tests.
 * - S3-compatible (RustFS via docker-compose) when `RUSTFS_ENDPOINT` is set.
 *
 * DB rows store only the stable `relativePath` key
 * (`pucc/<REG>/<stamp>-run-<id>-pucc.pdf`, `debug/<runId>/...`,
 * `uploads/documents/...`), so backends are interchangeable.
 *
 * Serving policy (Spec 01 §3.2): auth-checked proxy routes are primary
 * (`/api/pucc/:runId`, `/api/debug-artifact/:runId`, `/api/documents/:id`).
 * `getPresignedUrl()` exists for browser playback where streaming video
 * needs direct GETs (e.g. `<video src>` with Range); PDFs/images stay on
 * the proxy so logged-out URLs never leak.
 *
 * Never import this module from client components — it uses `node:fs` and
 * reads server secrets.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface SavedArtifact {
	/** Absolute path on server FS (local backend) or `s3://bucket/key`. */
	absolutePath: string;
	bucket?: string | undefined;
	contentType?: string | undefined;
	etag?: string | undefined;
	/** Path relative to the artifact root (stable for DB storage). */
	relativePath: string;
	sizeBytes?: number | undefined;
}

export interface ArtifactSaveOptions {
	contentType?: string | undefined;
}

export interface ArtifactStore {
	exists?(relativePath: string): Promise<boolean>;
	getPresignedUrl?(
		relativePath: string,
		expiresInSec?: number,
	): Promise<string>;
	read(relativePath: string): Promise<Buffer>;
	save(
		relativePath: string,
		data: Buffer | Uint8Array,
		opts?: ArtifactSaveOptions,
	): Promise<SavedArtifact>;
}

export function resolveArtifactDir(): string {
	const configured = process.env.ARTIFACT_DIR?.trim();
	if (configured) return resolve(configured);
	return resolve(process.cwd(), ".local", "artifacts");
}

export function resolveRustfsConfig(): {
	accessKey: string;
	bucketArtifacts: string;
	bucketDocuments: string;
	endpoint: string;
	region: string;
	secretKey: string;
} | null {
	const endpoint = process.env.RUSTFS_ENDPOINT?.trim();
	if (!endpoint) return null;
	const accessKey = process.env.RUSTFS_ACCESS_KEY?.trim() || "rustfsadmin";
	const secretKey = process.env.RUSTFS_SECRET_KEY?.trim() || "rustfsadmin";
	const region = process.env.RUSTFS_REGION?.trim() || "us-east-1";
	const bucketArtifacts =
		process.env.RUSTFS_BUCKET_ARTIFACTS?.trim() || "artifacts";
	const bucketDocuments =
		process.env.RUSTFS_BUCKET_DOCUMENTS?.trim() || "documents";
	return {
		accessKey,
		bucketArtifacts,
		bucketDocuments,
		endpoint: endpoint.replace(/\/+$/, ""),
		region,
		secretKey,
	};
}

export function isS3ArtifactStoreConfigured(): boolean {
	return resolveRustfsConfig() !== null;
}

function sanitizeSegment(segment: string): string {
	const cleaned = segment.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
	const trimmed = cleaned.replace(/^[-.]+|[-.]+$/g, "");
	return trimmed || "artifact";
}

export function sanitizeRelative(relativePath: string): string {
	const segments = relativePath
		.split("/")
		.map((s) => sanitizeSegment(s))
		.filter(Boolean);
	const safeRelative = segments.join("/");
	if (!safeRelative) throw new Error("Empty artifact path.");
	return safeRelative;
}

export function isDocumentKey(relativePath: string): boolean {
	return sanitizeRelative(relativePath).startsWith("uploads/documents/");
}

export function contentTypeForKey(relativePath: string): string {
	const lower = relativePath.toLowerCase();
	if (lower.endsWith(".pdf")) return "application/pdf";
	if (lower.endsWith(".webm")) return "video/webm";
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	if (lower.endsWith(".log") || lower.endsWith(".txt")) return "text/plain";
	if (lower.endsWith(".json")) return "application/json";
	return "application/octet-stream";
}

export function bucketForKey(
	relativePath: string,
	cfg: { bucketArtifacts: string; bucketDocuments: string },
): string {
	return isDocumentKey(relativePath)
		? cfg.bucketDocuments
		: cfg.bucketArtifacts;
}

export function sanitizeFilename(name: string): string {
	const base = name.split("/").pop()?.split("\\").pop() ?? "upload";
	const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
	return cleaned.replace(/^[-.]+|[-.]+$/g, "").slice(0, 120) || "upload";
}

export function sanitizeUploadKeyPart(
	value: string,
	fallback = "unlinked",
): string {
	const cleaned =
		value
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 20) || fallback;
	return cleaned;
}

class LocalArtifactStore implements ArtifactStore {
	readonly baseDir: string;

	constructor(baseDir?: string) {
		this.baseDir = baseDir ?? resolveArtifactDir();
	}

	async exists(relativePath: string): Promise<boolean> {
		try {
			readFileSync(this.resolve(relativePath));
			return true;
		} catch {
			return false;
		}
	}

	async getPresignedUrl(): Promise<string> {
		throw new Error(
			"Presigned URLs require RUSTFS_ENDPOINT (S3 backend); local store has no presigned-URL support — serve via auth-checked proxy routes.",
		);
	}

	async read(relativePath: string): Promise<Buffer> {
		const absolutePath = this.resolve(relativePath);
		return readFileSync(absolutePath);
	}

	async save(
		relativePath: string,
		data: Buffer | Uint8Array,
		opts?: ArtifactSaveOptions,
	): Promise<SavedArtifact> {
		const safeRelative = sanitizeRelative(relativePath);
		const absolutePath = join(this.baseDir, safeRelative);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, data);
		const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
		return {
			absolutePath,
			contentType: opts?.contentType ?? contentTypeForKey(safeRelative),
			relativePath: safeRelative,
			sizeBytes: bytes.length,
		};
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

class S3ArtifactStore implements ArtifactStore {
	private readonly cfg: NonNullable<ReturnType<typeof resolveRustfsConfig>>;

	constructor(cfg?: NonNullable<ReturnType<typeof resolveRustfsConfig>>) {
		const resolved = cfg ?? resolveRustfsConfig();
		if (!resolved) throw new Error("RUSTFS_ENDPOINT is not configured.");
		this.cfg = resolved;
	}

	private async client() {
		const { S3Client } = await import("@aws-sdk/client-s3");
		return new S3Client({
			credentials: {
				accessKeyId: this.cfg.accessKey,
				secretAccessKey: this.cfg.secretKey,
			},
			endpoint: this.cfg.endpoint,
			forcePathStyle: true,
			region: this.cfg.region,
		});
	}

	private bucketAndKey(relativePath: string): { bucket: string; key: string } {
		const key = sanitizeRelative(relativePath);
		return { bucket: bucketForKey(key, this.cfg), key };
	}

	private async ensureBucket(
		client: Awaited<ReturnType<S3ArtifactStore["client"]>>,
		bucket: string,
	): Promise<void> {
		const { HeadBucketCommand, CreateBucketCommand } = await import(
			"@aws-sdk/client-s3"
		);
		try {
			await client.send(new HeadBucketCommand({ Bucket: bucket }));
		} catch {
			await client.send(new CreateBucketCommand({ Bucket: bucket }));
		}
	}

	async exists(relativePath: string): Promise<boolean> {
		const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
		const { bucket, key } = this.bucketAndKey(relativePath);
		try {
			const client = await this.client();
			await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
			return true;
		} catch {
			return false;
		}
	}

	async read(relativePath: string): Promise<Buffer> {
		const { GetObjectCommand } = await import("@aws-sdk/client-s3");
		const { bucket, key } = this.bucketAndKey(relativePath);
		const client = await this.client();
		const res = await client.send(
			new GetObjectCommand({ Bucket: bucket, Key: key }),
		);
		const body = res.Body;
		if (!body) throw new Error(`Artifact not found: "${relativePath}".`);
		if (body instanceof Uint8Array) return Buffer.from(body);
		// Streaming body (Node Readable / web ReadableStream).
		const chunks: Uint8Array[] = [];
		const stream = body as unknown as AsyncIterable<Uint8Array>;
		for await (const chunk of stream) chunks.push(chunk);
		return Buffer.concat(chunks);
	}

	async save(
		relativePath: string,
		data: Buffer | Uint8Array,
		opts?: ArtifactSaveOptions,
	): Promise<SavedArtifact> {
		const { PutObjectCommand } = await import("@aws-sdk/client-s3");
		const { bucket, key } = this.bucketAndKey(relativePath);
		const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
		const contentType = opts?.contentType ?? contentTypeForKey(key);
		const client = await this.client();
		await this.ensureBucket(client, bucket);
		const res = await client.send(
			new PutObjectCommand({
				Body: bytes,
				Bucket: bucket,
				ContentType: contentType,
				Key: key,
			}),
		);
		return {
			absolutePath: `s3://${bucket}/${key}`,
			bucket,
			contentType,
			etag: res.ETag,
			relativePath: key,
			sizeBytes: bytes.length,
		};
	}

	async getPresignedUrl(
		relativePath: string,
		expiresInSec = 3600,
	): Promise<string> {
		const { GetObjectCommand } = await import("@aws-sdk/client-s3");
		const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
		const { bucket, key } = this.bucketAndKey(relativePath);
		const client = await this.client();
		return getSignedUrl(
			client,
			new GetObjectCommand({ Bucket: bucket, Key: key }),
			{ expiresIn: expiresInSec },
		);
	}
}

let singleton: ArtifactStore | null = null;

export function getArtifactStore(): ArtifactStore {
	if (singleton) return singleton;
	const cfg = resolveRustfsConfig();
	singleton = cfg ? new S3ArtifactStore(cfg) : new LocalArtifactStore();
	return singleton;
}

/** Test hook — resets the lazy singleton (e.g. after changing env). */
export function resetArtifactStore(): void {
	singleton = null;
}

export function createArtifactStore(baseDir: string): ArtifactStore {
	return new LocalArtifactStore(baseDir);
}

export function createS3ArtifactStore(
	cfg?: NonNullable<ReturnType<typeof resolveRustfsConfig>>,
): ArtifactStore {
	return new S3ArtifactStore(cfg);
}
