import { readFile } from "node:fs/promises";

import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { resolveArtifactDir } from "#/browser-automation/artifact-store";
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

				// Defense in depth: only serve files inside the artifact dir.
				const baseDir = resolveArtifactDir();
				if (!row.artifactPath.startsWith(`${baseDir}/`)) {
					return new Response("PUCC certificate not found", { status: 404 });
				}
				let data: Buffer;
				try {
					data = await readFile(row.artifactPath);
				} catch {
					return new Response("PUCC certificate no longer on disk", {
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
						"Content-Type": "application/pdf",
					},
				});
			},
		},
	},
});
