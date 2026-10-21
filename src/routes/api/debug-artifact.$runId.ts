import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { readArtifactCompat } from "#/browser-automation/artifact-compat";
import { contentTypeForKey } from "#/browser-automation/artifact-store";
import {
	browserAutomationSteps,
	llmRequests,
	workflowDebugs,
	workflowRuns,
} from "#/db-schema";
import { auth } from "#/lib/auth-server";
import { db } from "#/lib/db";

type ArtifactKind =
	| "video"
	| "console"
	| "artifact"
	| "screenshot"
	| "llm-image";

interface ResolvedArtifact {
	filename: string;
	key: string;
	mime: string;
}

/**
 * Single resolver for every debug-artifact download. GET and HEAD share
 * it; only the body/range handling differs. Returns a `Response` on
 * auth/ownership/missing-key failures so handlers stay thin.
 */
async function resolveArtifact(
	runId: number,
	userId: string,
	kind: string,
	stepIdParam: string | null,
): Promise<ResolvedArtifact | Response> {
	const [row] = await db
		.select()
		.from(workflowRuns)
		.where(and(eq(workflowRuns.id, runId), eq(workflowRuns.userId, userId)));
	if (!row) {
		return new Response("Run not found", { status: 404 });
	}
	const [debug] = await db
		.select()
		.from(workflowDebugs)
		.where(eq(workflowDebugs.runId, runId));
	if (debug && debug.userId !== userId) {
		return new Response("Run not found", { status: 404 });
	}
	const stepId = stepIdParam ?? "";
	const artifactKind = kind as ArtifactKind;
	let key: string | null = null;
	let mime = "application/octet-stream";
	let filename = `run-${runId}`;
	if (artifactKind === "video") {
		key = debug?.videoKey ?? null;
		mime = "video/webm";
		filename = `run-${runId}-recording.webm`;
	} else if (artifactKind === "console") {
		key = debug?.consoleLogKey ?? null;
		mime = "text/plain";
		filename = `run-${runId}-console.log`;
	} else if (artifactKind === "artifact") {
		key = row.artifactPath;
		mime = key ? contentTypeForKey(key) : "application/pdf";
		filename = `run-${runId}-artifact`;
	} else if (artifactKind === "screenshot" && stepId) {
		const [step] = await db
			.select()
			.from(browserAutomationSteps)
			.where(
				and(
					eq(browserAutomationSteps.id, Number(stepId)),
					eq(browserAutomationSteps.userId, userId),
				),
			);
		key = step?.screenshotKey ?? null;
		mime = "image/png";
		filename = `run-${runId}-step-${stepId}.png`;
	} else if (artifactKind === "llm-image" && stepId) {
		const [llm] = await db
			.select()
			.from(llmRequests)
			.where(eq(llmRequests.id, Number(stepId)));
		if (!llm || llm.userId !== userId) {
			return new Response("Image not found", { status: 404 });
		}
		key = llm.imageKey;
		mime = "image/png";
		filename = `run-${runId}-captcha-${llm.id}.png`;
	}
	if (!key) {
		return new Response("Artifact not found", { status: 404 });
	}
	return { filename, key, mime };
}

function disposition(mime: string, filename: string): string {
	if (mime === "application/pdf") {
		return `inline; filename="${filename}.pdf"`;
	}
	if (mime.startsWith("image/") || mime.startsWith("video/")) {
		return `inline; filename="${filename}"`;
	}
	return `attachment; filename="${filename}"`;
}

function parseRunId(request: Request): number | null {
	const runId = Number(new URL(request.url).pathname.split("/").pop() ?? "");
	return Number.isInteger(runId) ? runId : null;
}

export const Route = createFileRoute("/api/debug-artifact/$runId")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session?.user) {
					return new Response("Unauthorized", { status: 401 });
				}
				const runId = parseRunId(request);
				if (runId === null) {
					return new Response("Invalid run id", { status: 400 });
				}
				const url = new URL(request.url);
				const resolved = await resolveArtifact(
					runId,
					session.user.id,
					url.searchParams.get("kind") ?? "artifact",
					url.searchParams.get("stepId"),
				);
				if (resolved instanceof Response) return resolved;
				let data: Buffer;
				try {
					data = await readArtifactCompat(resolved.key);
				} catch {
					return new Response("Artifact no longer available", { status: 404 });
				}
				const headers: Record<string, string> = {
					"Cache-Control": "private, max-age=3600",
					"Content-Disposition": disposition(resolved.mime, resolved.filename),
					"Content-Length": String(data.length),
					"Content-Type": resolved.mime,
				};
				if (
					request.headers.get("range") &&
					resolved.mime.startsWith("video/")
				) {
					const range = request.headers.get("range") as string;
					const m = range.match(/bytes=(\d+)-(\d*)/);
					if (m) {
						const start = Number(m[1]);
						const end = m[2] ? Number(m[2]) : data.length - 1;
						const clampedEnd = Math.min(end, data.length - 1);
						if (start < data.length && start <= clampedEnd) {
							const slice = data.subarray(start, clampedEnd + 1);
							return new Response(new Uint8Array(slice), {
								headers: {
									...headers,
									"Accept-Ranges": "bytes",
									"Content-Length": String(slice.length),
									"Content-Range": `bytes ${start}-${clampedEnd}/${data.length}`,
								},
								status: 206,
							});
						}
					}
				}
				return new Response(new Uint8Array(data), { headers });
			},
			HEAD: async ({ request }: { request: Request }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session?.user) {
					return new Response(null, { status: 401 });
				}
				const runId = parseRunId(request);
				if (runId === null) {
					return new Response(null, { status: 400 });
				}
				const url = new URL(request.url);
				const resolved = await resolveArtifact(
					runId,
					session.user.id,
					url.searchParams.get("kind") ?? "artifact",
					url.searchParams.get("stepId"),
				);
				if (resolved instanceof Response) return resolved;
				let size = 0;
				try {
					size = (await readArtifactCompat(resolved.key)).length;
				} catch {
					return new Response(null, { status: 404 });
				}
				return new Response(null, {
					headers: {
						"Accept-Ranges": "bytes",
						"Cache-Control": "private, max-age=3600",
						"Content-Length": String(size),
						"Content-Type": resolved.mime,
					},
					status: 200,
				});
			},
		},
	},
});
