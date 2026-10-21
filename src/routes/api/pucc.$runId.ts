import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { readArtifactCompat } from "#/browser-automation/artifact-compat";
import { contentTypeForKey } from "#/browser-automation/artifact-store";
import { workflowRuns } from "#/db-schema";
import { auth } from "#/lib/auth-server";
import { db } from "#/lib/db";

export const Route = createFileRoute("/api/pucc/$runId")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session?.user) {
					return new Response("Unauthorized", { status: 401 });
				}

				const runId = Number(
					new URL(request.url).pathname.split("/").pop() ?? "",
				);
				if (!Number.isInteger(runId)) {
					return new Response("Invalid run id", { status: 400 });
				}

				const [row] = await db
					.select()
					.from(workflowRuns)
					.where(
						and(
							eq(workflowRuns.id, runId),
							eq(workflowRuns.userId, session.user.id),
						),
					);
				if (!row || row.status !== "succeeded" || !row.artifactPath) {
					return new Response("PUCC certificate not found", { status: 404 });
				}

				let data: Buffer;
				try {
					data = await readArtifactCompat(row.artifactPath);
				} catch {
					return new Response("PUCC certificate no longer available", {
						status: 404,
					});
				}

				const input = row.input as Record<string, unknown>;
				const output = row.output as Record<string, unknown> | null;
				const rawReg =
					output?.["registrationNumber"] ?? input["registrationNumber"];
				const reg =
					typeof rawReg === "string" && rawReg
						? rawReg.replace(/[^A-Z0-9]/gi, "")
						: String(row.id);
				return new Response(new Uint8Array(data), {
					headers: {
						"Cache-Control": "private, max-age=3600",
						"Content-Disposition": `inline; filename="PUCC-${reg}.pdf"`,
						"Content-Length": String(data.length),
						"Content-Type": contentTypeForKey(row.artifactPath),
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
				const runId = Number(
					new URL(request.url).pathname.split("/").pop() ?? "",
				);
				if (!Number.isInteger(runId)) {
					return new Response(null, { status: 400 });
				}
				const [row] = await db
					.select()
					.from(workflowRuns)
					.where(
						and(
							eq(workflowRuns.id, runId),
							eq(workflowRuns.userId, session.user.id),
						),
					);
				if (!row || row.status !== "succeeded" || !row.artifactPath) {
					return new Response(null, { status: 404 });
				}
				let size = 0;
				try {
					const data = await readArtifactCompat(row.artifactPath);
					size = data.length;
				} catch {
					return new Response(null, { status: 404 });
				}
				return new Response(null, {
					headers: {
						"Cache-Control": "private, max-age=3600",
						"Content-Length": String(size),
						"Content-Type": contentTypeForKey(row.artifactPath),
					},
					status: 200,
				});
			},
		},
	},
});
