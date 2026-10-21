/**
 * CLI runner for async browser workflows.
 *
 * Default (Spec 03 §5): enqueues via the engine (`enqueueWorkflowRun`) so
 * Spec-02 observability rows (`debug.workflows/steps/logs/llm_requests`)
 * are written identically whether the run was enqueued from UI or CLI.
 * Polls `getWorkflowRun` until terminal and prints the output.
 *
 * `--direct` keeps the old headless-direct behavior (no queue/DB row) for
 * low-level debugging, e.g. with `--mock-captcha` (no AI spend).
 *
 * Usage:
 *   bun scripts/run-workflow.ts pucc --reg MH01CR7464 --chassis 12345 [--vehicle-id 1] [--user-id <id>]
 *   bun scripts/run-workflow.ts transaction-history --reg MH01CR7464 --vehicle-id 1 [--user-id <id>]
 *   bun scripts/run-workflow.ts pucc --reg MH01CR7464 --chassis 12345 --direct [--mock-captcha ABC123] [--headless]
 *
 * Env:
 *   DATABASE_URL (required for queued mode)
 *   WORKFLOW_USER_ID (default user when --user-id omitted; else first user in DB)
 *   META_AI_API_KEY / META_AI_BASE_URL / META_AI_MODEL (live CAPTCHA solve)
 *   HEADLESS=1 (or --headless)
 */

import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { CaptchaSolver } from "../src/browser-automation/captcha.ts";
import * as schema from "../src/db-schema/index.ts";

function argValue(name: string): string | undefined {
	const prefix = `--${name}`;
	const idx = process.argv.findIndex(
		(a) => a === prefix || a.startsWith(`${prefix}=`),
	);
	if (idx === -1) return undefined;
	const raw = process.argv[idx] ?? "";
	if (raw.includes("=")) return raw.slice(prefix.length + 1) || undefined;
	return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

async function resolveUserId(
	db: ReturnType<typeof drizzle<typeof schema>>,
): Promise<string> {
	const explicit = argValue("user-id") ?? process.env.WORKFLOW_USER_ID?.trim();
	if (explicit) return explicit;
	const [first] = await db
		.select({ id: schema.users.id })
		.from(schema.users)
		.limit(1);
	if (!first) {
		throw new Error(
			"No users in DB and no --user-id / WORKFLOW_USER_ID. Run `bun run dev:seed` first.",
		);
	}
	return first.id;
}

async function resolveVehicleId(
	db: ReturnType<typeof drizzle<typeof schema>>,
	userId: string,
	reg: string,
): Promise<number | null> {
	const explicit = argValue("vehicle-id") ?? argValue("vehicleId");
	if (explicit) {
		const n = Number(explicit);
		if (!Number.isInteger(n))
			throw new Error(`Invalid --vehicle-id "${explicit}".`);
		const [full] = await db
			.select()
			.from(schema.vehicles)
			.where(eq(schema.vehicles.id, n));
		if (!full || full.userId !== userId) {
			throw new Error(`Vehicle #${n} not found for this user.`);
		}
		return full.id;
	}
	const { normalizeRegistrationNumber } = await import(
		"../src/lib/vehicle-registration.ts"
	);
	let normalized: string;
	try {
		normalized = normalizeRegistrationNumber(reg);
	} catch {
		return null;
	}
	const [hit] = await db
		.select({ id: schema.vehicles.id })
		.from(schema.vehicles)
		.where(
			and(
				eq(schema.vehicles.userId, userId),
				eq(schema.vehicles.registrationNumber, normalized),
			),
		);
	return hit?.id ?? null;
}

async function enqueueAndWait(input: {
	input: Record<string, unknown>;
	userId: string;
	vehicleId: number | null;
	workflowName: string;
}): Promise<void> {
	const { enqueueWorkflowRun, getWorkflowRun } = await import(
		"../src/browser-automation/engine.ts"
	);
	await import("../src/browser-automation/workflows/pucc.ts");
	await import(
		"../src/browser-automation/workflows/vahan-transaction-history.ts"
	);
	const run = await enqueueWorkflowRun({
		input: input.input,
		userId: input.userId,
		vehicleId: input.vehicleId,
		workflowName: input.workflowName,
	});
	console.log(
		`[workflow:cli] enqueued ${input.workflowName} run #${run.id} (user=${input.userId}) — polling…`,
	);
	const deadline = Date.now() + 10 * 60 * 1000;
	for (;;) {
		await new Promise((r) => setTimeout(r, 3000));
		const cur = await getWorkflowRun(run.id, input.userId);
		if (!cur) throw new Error(`Run #${run.id} disappeared.`);
		if (cur.status === "queued" || cur.status === "running") {
			if (Date.now() > deadline) {
				throw new Error(
					`Run #${run.id} still ${cur.status} after 10m — check /runs/${run.id}.`,
				);
			}
			continue;
		}
		if (cur.status === "succeeded") {
			console.log("[workflow:cli] succeeded:");
			console.log(JSON.stringify(cur.output ?? cur, null, 2));
			console.log(`[workflow:cli] detail: /runs/${cur.id}`);
			return;
		}
		console.error(
			`[workflow:cli] run #${cur.id} failed: ${cur.error ?? "unknown"}`,
		);
		console.error(JSON.stringify(cur, null, 2));
		process.exitCode = 1;
		return;
	}
}

interface DirectCommonArgs {
	log: (...args: unknown[]) => void;
	maxCaptchaAttempts?: number | undefined;
	mockCaptcha?: string | undefined;
	timeoutMs?: number | undefined;
}

function parseDirectCommonArgs(tag: string): DirectCommonArgs {
	const mockCaptcha = argValue("mock-captcha")?.trim();
	const timeoutMs = Number(argValue("timeout-ms") ?? "") || undefined;
	const maxCaptchaAttempts =
		Number(argValue("max-attempts") ?? "") || undefined;
	const log = (...args: unknown[]) => console.log(`[${tag}:cli]`, ...args);
	return {
		log,
		...(maxCaptchaAttempts !== undefined ? { maxCaptchaAttempts } : {}),
		...(mockCaptcha ? { mockCaptcha } : {}),
		...(timeoutMs !== undefined ? { timeoutMs } : {}),
	};
}

type DirectDeps =
	| {
			captchaSolver: CaptchaSolver;
			log: (...args: unknown[]) => void;
	  }
	| {
			log: (...args: unknown[]) => void;
	  };

function mockSolverDeps(common: DirectCommonArgs): DirectDeps {
	if (!common.mockCaptcha) return { log: common.log };
	const code = common.mockCaptcha;
	const captchaSolver: CaptchaSolver = async () => ({
		code,
		confidence: 1,
		raw: code,
	});
	return { captchaSolver, log: common.log };
}

async function reportDirectSuccess(output: unknown): Promise<void> {
	console.log("[workflow:cli] succeeded (direct, no DB row):");
	console.log(JSON.stringify(output, null, 2));
}

async function runDirectPucc(): Promise<void> {
	const { browserAutomation } = await import(
		"../src/browser-automation/index.ts"
	);
	const { fetchPuccCertificateDirect } = await import(
		"../src/browser-automation/workflows/pucc.ts"
	);
	const reg = argValue("reg") ?? argValue("registration");
	const chassis = argValue("chassis") ?? argValue("chassis-last5");
	if (!reg || !chassis) {
		console.error("Missing required args: --reg <REG> --chassis <LAST5>");
		process.exit(1);
	}
	const common = parseDirectCommonArgs("pucc");
	console.log(
		`[workflow:cli] direct pucc reg=${reg} chassis=***${chassis.slice(-2)} headless=${process.env.HEADLESS ?? "0"}`,
	);
	try {
		const output = await fetchPuccCertificateDirect(
			{
				chassisLast5: chassis,
				registrationNumber: reg,
				...(common.maxCaptchaAttempts !== undefined
					? { maxCaptchaAttempts: common.maxCaptchaAttempts }
					: {}),
				...(common.timeoutMs !== undefined
					? { timeoutMs: common.timeoutMs }
					: {}),
			},
			mockSolverDeps(common),
		);
		await reportDirectSuccess(output);
	} catch (err) {
		console.error("[workflow:cli] failed:");
		console.error(err instanceof Error ? (err.stack ?? err.message) : err);
		process.exitCode = 1;
	} finally {
		await browserAutomation.close().catch(() => {});
		process.exit(process.exitCode ?? 0);
	}
}

async function runDirectTransactionHistory(): Promise<void> {
	const { browserAutomation } = await import(
		"../src/browser-automation/index.ts"
	);
	const { fetchTransactionHistoryDirect } = await import(
		"../src/browser-automation/workflows/vahan-transaction-history.ts"
	);
	const reg = argValue("reg") ?? argValue("registration");
	if (!reg) {
		console.error("Missing required args: --reg <REG>");
		process.exit(1);
	}
	const common = parseDirectCommonArgs("vahan-tx");
	console.log(
		`[workflow:cli] direct transaction-history reg=${reg} headless=${process.env.HEADLESS ?? "0"}`,
	);
	try {
		const output = await fetchTransactionHistoryDirect(
			{
				registrationNumber: reg,
				...(common.maxCaptchaAttempts !== undefined
					? { maxCaptchaAttempts: common.maxCaptchaAttempts }
					: {}),
				...(common.timeoutMs !== undefined
					? { timeoutMs: common.timeoutMs }
					: {}),
			},
			mockSolverDeps(common),
		);
		await reportDirectSuccess(output);
	} catch (err) {
		console.error("[workflow:cli] failed:");
		console.error(err instanceof Error ? (err.stack ?? err.message) : err);
		process.exitCode = 1;
	} finally {
		await browserAutomation.close().catch(() => {});
		process.exit(process.exitCode ?? 0);
	}
}

async function main(): Promise<void> {
	const command = process.argv[2];
	if (command !== "pucc" && command !== "transaction-history") {
		console.error(
			"Usage: bun scripts/run-workflow.ts pucc --reg <REG> --chassis <LAST5> [--vehicle-id N] [--user-id ID] [--direct] [--mock-captcha CODE]",
		);
		console.error(
			"   or: bun scripts/run-workflow.ts transaction-history --reg <REG> --vehicle-id N [--user-id ID] [--direct]",
		);
		process.exit(1);
	}
	if (hasFlag("headless")) process.env.HEADLESS = "1";
	const direct = hasFlag("direct") || Boolean(argValue("mock-captcha")?.trim());
	if (direct) {
		console.log(
			"[workflow:cli] --direct: running without queue/DB row (no observability ledger). Omit --direct/--mock-captcha for the queued path.",
		);
		if (command === "pucc") {
			await runDirectPucc();
			return;
		}
		await runDirectTransactionHistory();
		return;
	}
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error("DATABASE_URL is not set. Queued mode needs the database.");
		process.exit(1);
	}
	const pool = new Pool({ connectionString: databaseUrl });
	const db = drizzle(pool, { schema });
	try {
		const userId = await resolveUserId(db);
		if (command === "pucc") {
			const reg = argValue("reg") ?? argValue("registration");
			const chassis = argValue("chassis") ?? argValue("chassis-last5");
			if (!reg || !chassis) {
				console.error("Missing required args: --reg <REG> --chassis <LAST5>");
				process.exit(1);
			}
			const vehicleId = await resolveVehicleId(db, userId, reg);
			const timeoutMs = Number(argValue("timeout-ms") ?? "") || undefined;
			const maxCaptchaAttempts =
				Number(argValue("max-attempts") ?? "") || undefined;
			await enqueueAndWait({
				input: {
					chassisLast5: chassis,
					registrationNumber: reg,
					...(maxCaptchaAttempts !== undefined ? { maxCaptchaAttempts } : {}),
					...(timeoutMs !== undefined ? { timeoutMs } : {}),
					...(vehicleId !== null ? { vehicleId } : {}),
				},
				userId,
				vehicleId,
				workflowName: "pucc-fetch",
			});
		} else {
			const reg = argValue("reg") ?? argValue("registration");
			if (!reg) {
				console.error("Missing required args: --reg <REG> --vehicle-id N");
				process.exit(1);
			}
			const vehicleId = await resolveVehicleId(db, userId, reg);
			if (vehicleId === null) {
				console.error(
					"transaction-history needs --vehicle-id (or a vehicle with this reg owned by the resolved user).",
				);
				process.exit(1);
			}
			const timeoutMs = Number(argValue("timeout-ms") ?? "") || undefined;
			const maxCaptchaAttempts =
				Number(argValue("max-attempts") ?? "") || undefined;
			await enqueueAndWait({
				input: {
					registrationNumber: reg,
					...(maxCaptchaAttempts !== undefined ? { maxCaptchaAttempts } : {}),
					...(timeoutMs !== undefined ? { timeoutMs } : {}),
					vehicleId,
				},
				userId,
				vehicleId,
				workflowName: "vahan-transaction-history",
			});
		}
	} finally {
		const { browserAutomation } = await import(
			"../src/browser-automation/index.ts"
		);
		await browserAutomation.close().catch(() => {});
		await pool.end().catch(() => {});
		process.exit(process.exitCode ?? 0);
	}
}

void main();
