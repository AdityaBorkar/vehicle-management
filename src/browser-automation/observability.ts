/**
 * Server-only observability harness (Spec 02).
 *
 * - Console/pageerror capture -> `debug.logs`
 * - Step wrapper (`step()`) -> `debug.browser_automation_steps`
 *   with warn-on-retry semantics and screenshots on error.
 * - Video finalization: the persistent browser context records video to a
 *   local dir (see `index.ts`); `finalizeVideo()` uploads the file for a
 *   run to the artifact store and records `debug.workflows.video_key`.
 * - Console dump upload: `finalizeConsoleLog()` writes NDJSON to the store.
 *
 * All writes are best-effort — observability must never fail a run.
 */

import {
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { and, count, eq } from "drizzle-orm";
import type { Page } from "patchright";

import { browserAutomationSteps, debugLogs, workflowDebugs } from "#/db-schema";
import { db } from "#/lib/db";
import { getArtifactStore } from "./artifact-store";

export type StepStatus = "ok" | "warn" | "error";
export type LogLevel = "debug" | "info" | "warn" | "error";

const seqByRun = new Map<number, number>();

function truncate(value: string, max: number): string {
	return value.length > max ? value.slice(0, max) : value;
}

async function nextSeq(runId: number, userId: string): Promise<number> {
	const cached = seqByRun.get(runId);
	if (cached !== undefined) {
		const next = cached + 1;
		seqByRun.set(runId, next);
		return next;
	}
	try {
		const [row] = await db
			.select({ n: count() })
			.from(browserAutomationSteps)
			.where(
				and(
					eq(browserAutomationSteps.runId, runId),
					eq(browserAutomationSteps.userId, userId),
				),
			);
		const next = (row?.n ?? 0) + 1;
		seqByRun.set(runId, next);
		return next;
	} catch {
		return 1;
	}
}

export function clearRunSeq(runId: number): void {
	seqByRun.delete(runId);
}

export async function recordLog(input: {
	level?: LogLevel | undefined;
	message: string;
	meta?: Record<string, unknown> | undefined;
	runId: number;
	source: string;
	userId: string;
}): Promise<void> {
	try {
		await db.insert(debugLogs).values({
			level: input.level ?? "info",
			message: truncate(input.message, 8000),
			meta: input.meta ?? null,
			runId: input.runId,
			source: input.source,
			userId: input.userId,
		});
	} catch (err) {
		console.error("[observability] recordLog failed:", err);
	}
}

export async function recordStep(input: {
	attempt?: number | undefined;
	kind: string;
	label: string;
	message?: string | undefined;
	runId: number;
	screenshotKey?: string | null | undefined;
	status?: StepStatus | undefined;
	userId: string;
}): Promise<void> {
	try {
		const seq = await nextSeq(input.runId, input.userId);
		await db.insert(browserAutomationSteps).values({
			attempt: input.attempt ?? 1,
			finishedAt: new Date(),
			kind: input.kind,
			label: input.label,
			message: input.message ? truncate(input.message, 4000) : null,
			runId: input.runId,
			screenshotKey: input.screenshotKey ?? null,
			seq,
			status: input.status ?? "ok",
			userId: input.userId,
		});
		if (input.status === "warn" || input.status === "error") {
			await bumpWorkflowCounters(
				input.runId,
				input.userId,
				input.status === "warn" ? { warnings: 1 } : { errors: 1 },
			);
		}
	} catch (err) {
		console.error("[observability] recordStep failed:", err);
	}
}

async function bumpWorkflowCounters(
	runId: number,
	userId: string,
	delta: { errors?: number | undefined; warnings?: number | undefined },
): Promise<void> {
	try {
		const [row] = await db
			.select()
			.from(workflowDebugs)
			.where(eq(workflowDebugs.runId, runId));
		if (!row) return;
		if (row.userId !== userId) return;
		await db
			.update(workflowDebugs)
			.set({
				errorCount: (row.errorCount ?? 0) + (delta.errors ?? 0),
				warningCount: (row.warningCount ?? 0) + (delta.warnings ?? 0),
			})
			.where(eq(workflowDebugs.runId, runId));
	} catch (err) {
		console.error("[observability] bumpWorkflowCounters failed:", err);
	}
}

/**
 * Wrap an async action as an auditable step. On retryable failure the
 * caller should catch and call `recordStep({...status:"warn"})` before
 * retrying; terminal failures are recorded as `error` with a screenshot.
 */
export async function runStep<T>(input: {
	attempt?: number | undefined;
	kind: string;
	label: string;
	page?: Page | undefined;
	runId: number;
	screenshotOnError?: boolean | undefined;
	userId: string;
	fn: () => Promise<T>;
}): Promise<T> {
	const startedAt = new Date();
	try {
		const result = await input.fn();
		await recordStep({
			attempt: input.attempt ?? 1,
			kind: input.kind,
			label: input.label,
			runId: input.runId,
			status: "ok",
			userId: input.userId,
		});
		return result;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		let screenshotKey: string | null = null;
		if (input.screenshotOnError !== false && input.page) {
			screenshotKey = await captureScreenshot(
				input.page,
				input.runId,
				input.label,
			);
		}
		try {
			const seq = await nextSeq(input.runId, input.userId);
			await db.insert(browserAutomationSteps).values({
				attempt: input.attempt ?? 1,
				finishedAt: new Date(),
				kind: input.kind,
				label: input.label,
				message: truncate(message, 4000),
				runId: input.runId,
				screenshotKey,
				seq,
				startedAt,
				status: "error",
				userId: input.userId,
			});
			await bumpWorkflowCounters(input.runId, input.userId, { errors: 1 });
		} catch (dbErr) {
			console.error("[observability] runStep error persist failed:", dbErr);
		}
		throw err;
	}
}

export async function recordWarning(input: {
	attempt?: number | undefined;
	kind?: string | undefined;
	label: string;
	message: string;
	runId: number;
	userId: string;
}): Promise<void> {
	await recordStep({
		attempt: input.attempt ?? 1,
		kind: input.kind ?? "retry",
		label: input.label,
		message: input.message,
		runId: input.runId,
		status: "warn",
		userId: input.userId,
	});
}

async function captureScreenshot(
	page: Page,
	runId: number,
	label: string,
): Promise<string | null> {
	try {
		const bytes = await page.screenshot({ timeout: 8000 });
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const key = `debug/${runId}/step-${stamp}.png`;
		const saved = await getArtifactStore().save(key, Buffer.from(bytes), {
			contentType: "image/png",
		});
		return saved.relativePath;
	} catch (err) {
		console.error(`[observability] screenshot failed (${label}):`, err);
		return null;
	}
}

export async function captureFailureScreenshot(
	page: Page,
	runId: number,
	label = "failure",
): Promise<string | null> {
	return captureScreenshot(page, runId, label);
}

export interface ConsoleCapture {
	detach: () => void;
	/** Buffered lines (also persisted per-line to debug.logs). */
	lines: string[];
}

export function attachConsoleCapture(
	page: Page,
	runId: number,
	userId: string,
): ConsoleCapture {
	const lines: string[] = [];
	const onConsole = (msg: { text(): string; type(): string }) => {
		try {
			const text = msg.text();
			const type = msg.type();
			const level: LogLevel =
				type === "error" ? "error" : type === "warning" ? "warn" : "info";
			const line = `[${type}] ${text}`;
			lines.push(truncate(line, 2000));
			void recordLog({
				level,
				message: truncate(text, 8000),
				meta: { consoleType: type },
				runId,
				source: "browser-console",
				userId,
			});
		} catch (err) {
			console.error("[observability] console handler failed:", err);
		}
	};
	const onPageError = (err: Error) => {
		const line = `[pageerror] ${err.message}`;
		lines.push(truncate(line, 2000));
		void recordLog({
			level: "error",
			message: truncate(err.message, 8000),
			runId,
			source: "browser-console",
			userId,
		});
	};
	page.on("console", onConsole);
	page.on("pageerror", onPageError);
	return {
		detach: () => {
			page.off("console", onConsole);
			page.off("pageerror", onPageError);
		},
		lines,
	};
}

export function resolveVideoDir(): string {
	const configured = process.env.BROWSER_VIDEO_DIR?.trim();
	if (configured) return resolve(configured);
	return resolve(process.cwd(), ".local", "videos");
}

export function ensureVideoDir(): string {
	const dir = resolveVideoDir();
	mkdirSync(dir, { recursive: true });
	try {
		// Probe writability; fall back to tmp when the repo dir is read-only.
		const probe = join(dir, ".write-probe");
		writeFileSync(probe, "ok");
		rmSync(probe, { force: true });
		return dir;
	} catch {
		const fallback = join(tmpdir(), "vehicle-management-videos");
		mkdirSync(fallback, { recursive: true });
		return fallback;
	}
}

/**
 * Upload the newest video file for a run (patchright names them after the
 * page/context) to `debug/<runId>/recording.webm`. Best-effort: returns the
 * storage key or null when recording was unavailable (e.g. headed profile
 * without video support). When unavailable a `warn` step is recorded so the
 * run timeline shows screenshots-only mode (Spec 02 §4.2).
 */
export async function finalizeVideo(
	runId: number,
	userId: string,
): Promise<string | null> {
	try {
		const dir = resolveVideoDir();
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			await recordWarning({
				kind: "video",
				label: "Screen recording unavailable",
				message:
					"Video directory is missing — continuing screenshots-only for this run.",
				runId,
				userId,
			});
			return null;
		}
		const videos = entries
			.filter((e) => e.toLowerCase().endsWith(".webm"))
			.map((e) => {
				const full = join(dir, e);
				let mtime = 0;
				try {
					mtime = statSync(full).mtimeMs;
				} catch {
					mtime = 0;
				}
				return { full, mtime };
			})
			.sort((a, b) => b.mtime - a.mtime);
		const latest = videos[0];
		if (!latest) {
			await recordWarning({
				kind: "video",
				label: "Screen recording unavailable",
				message:
					"No .webm recording found for this run — continuing screenshots-only.",
				runId,
				userId,
			});
			return null;
		}
		const data = readFileSync(latest.full);
		const key = `debug/${runId}/recording.webm`;
		const saved = await getArtifactStore().save(key, data, {
			contentType: "video/webm",
		});
		try {
			rmSync(latest.full, { force: true });
		} catch {
			// best-effort cleanup
		}
		try {
			await db
				.update(workflowDebugs)
				.set({ videoKey: saved.relativePath })
				.where(eq(workflowDebugs.runId, runId));
		} catch (err) {
			console.error("[observability] video_key update failed:", err);
		}
		await recordLog({
			level: "info",
			message: `Screen recording saved: ${saved.relativePath} (${data.length} bytes)`,
			runId,
			source: "workflow",
			userId,
		});
		return saved.relativePath;
	} catch (err) {
		console.error("[observability] finalizeVideo failed:", err);
		return null;
	}
}

export async function finalizeConsoleLog(
	runId: number,
	userId: string,
	lines: string[],
): Promise<string | null> {
	try {
		if (lines.length === 0) return null;
		const body = `${lines.join("\n")}\n`;
		const key = `debug/${runId}/console.log`;
		const saved = await getArtifactStore().save(key, Buffer.from(body), {
			contentType: "text/plain",
		});
		try {
			await db
				.update(workflowDebugs)
				.set({ consoleLogKey: saved.relativePath })
				.where(
					and(
						eq(workflowDebugs.runId, runId),
						eq(workflowDebugs.userId, userId),
					),
				);
		} catch (err) {
			console.error("[observability] console_log_key update failed:", err);
		}
		return saved.relativePath;
	} catch (err) {
		console.error("[observability] finalizeConsoleLog failed:", err);
		return null;
	}
}
