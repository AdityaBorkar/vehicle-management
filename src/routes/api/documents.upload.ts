import { createFileRoute } from "@tanstack/react-router";

import {
	contentTypeForKey,
	getArtifactStore,
	sanitizeFilename,
	sanitizeUploadKeyPart,
} from "#/browser-automation/artifact-store";
import { auth } from "#/lib/auth-server";
import {
	ALLOWED_DOCUMENT_MIMES,
	MAX_DOCUMENT_BYTES,
} from "#/lib/manual-documents";

/** Re-exported for route tests — canonical implementation lives in artifact-store. */
export { sanitizeFilename };

export const Route = createFileRoute("/api/documents/upload")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session?.user) {
					return new Response("Unauthorized", { status: 401 });
				}
				let form: FormData;
				try {
					form = await request.formData();
				} catch {
					return new Response("Invalid multipart body", { status: 400 });
				}
				const file = form.get("file");
				const vehicleReg =
					(typeof form.get("vehicleReg") === "string"
						? (form.get("vehicleReg") as string)
						: "") || "unlinked";
				const kind =
					(typeof form.get("kind") === "string"
						? (form.get("kind") as string)
						: "") || "document";
				if (!(file instanceof File)) {
					return new Response("Missing file field", { status: 400 });
				}
				if (
					!(ALLOWED_DOCUMENT_MIMES as readonly string[]).includes(file.type)
				) {
					return new Response("Only PDF, JPEG or PNG files are allowed.", {
						status: 400,
					});
				}
				if (file.size > MAX_DOCUMENT_BYTES) {
					return new Response("File exceeds the 10 MB limit.", { status: 400 });
				}
				const bytes = Buffer.from(await file.arrayBuffer());
				const safeReg = sanitizeUploadKeyPart(vehicleReg, "unlinked");
				const safeKind =
					kind.replace(/[^a-z0-9_]+/gi, "-").slice(0, 30) || "document";
				const stamp = new Date().toISOString().replace(/[:.]/g, "-");
				const key = `uploads/documents/${safeReg}/${safeKind}/${stamp}-${sanitizeFilename(file.name)}`;
				try {
					const saved = await getArtifactStore().save(key, bytes, {
						contentType: file.type || contentTypeForKey(key),
					});
					return Response.json({
						fileKey: saved.relativePath,
						fileMime: file.type,
						fileName: file.name,
						fileSizeBytes: file.size,
					});
				} catch (err) {
					console.error("[documents.upload] save failed:", err);
					return new Response("Upload failed", { status: 500 });
				}
			},
		},
	},
});
