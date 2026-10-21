import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import {
	contentTypeForKey,
	getArtifactStore,
} from "#/browser-automation/artifact-store";
import { documents } from "#/db-schema";
import { auth } from "#/lib/auth-server";
import { db } from "#/lib/db";

function contentDisposition(filename: string, mime: string): string {
	const safe = filename.replace(/["\r\n]/g, "_").slice(0, 180) || "document";
	const inline = mime === "application/pdf" || mime.startsWith("image/");
	return `${inline ? "inline" : "attachment"}; filename="${safe}"`;
}

export const Route = createFileRoute("/api/documents/$documentId")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session?.user) {
					return new Response("Unauthorized", { status: 401 });
				}
				const documentId = Number(
					new URL(request.url).pathname.split("/").pop() ?? "",
				);
				if (!Number.isInteger(documentId)) {
					return new Response("Invalid document id", { status: 400 });
				}
				const [row] = await db
					.select()
					.from(documents)
					.where(
						and(
							eq(documents.id, documentId),
							eq(documents.userId, session.user.id),
						),
					);
				if (!row?.fileKey) {
					return new Response("Document file not found", { status: 404 });
				}
				let data: Buffer;
				try {
					data = await getArtifactStore().read(row.fileKey);
				} catch {
					return new Response("Document file no longer available", {
						status: 404,
					});
				}
				const mime = row.fileMime || contentTypeForKey(row.fileKey);
				return new Response(new Uint8Array(data), {
					headers: {
						"Cache-Control": "private, max-age=3600",
						"Content-Disposition": contentDisposition(
							row.fileName || `document-${row.id}`,
							mime,
						),
						"Content-Length": String(data.length),
						"Content-Type": mime,
					},
				});
			},
			HEAD: async ({ request }: { request: Request }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session?.user) {
					return new Response(null, { status: 401 });
				}
				const documentId = Number(
					new URL(request.url).pathname.split("/").pop() ?? "",
				);
				if (!Number.isInteger(documentId)) {
					return new Response(null, { status: 400 });
				}
				const [row] = await db
					.select()
					.from(documents)
					.where(
						and(
							eq(documents.id, documentId),
							eq(documents.userId, session.user.id),
						),
					);
				if (!row?.fileKey) {
					return new Response(null, { status: 404 });
				}
				let size = 0;
				let mime = row.fileMime || "application/octet-stream";
				try {
					const data = await getArtifactStore().read(row.fileKey);
					size = data.length;
					if (!row.fileMime) {
						mime = contentTypeForKey(row.fileKey);
					}
				} catch {
					return new Response(null, { status: 404 });
				}
				return new Response(null, {
					headers: {
						"Cache-Control": "private, max-age=3600",
						"Content-Length": String(size),
						"Content-Type": mime,
					},
					status: 200,
				});
			},
		},
	},
});
