/**
 * CLI runner for async browser workflows.
 *
 * The UI enqueues runs via oRPC (`workflow.startPucc`,
 * `vehicleTransaction.refresh`) and the engine processes them in-process.
 * This CLI runs the same workflows directly (no queue/DB row) for
 * debugging.
 *
 * Usage:
 *   bun scripts/run-workflow.ts pucc --reg MH01CR7464 --chassis 12345
 *   bun scripts/run-workflow.ts transaction-history --reg MH01CR7464
 *   bun scripts/run-workflow.ts transaction-history --reg MH01CR7464 --headless --mock-captcha ABC123
 *
 * Env:
 *   META_AI_API_KEY / META_AI_BASE_URL / META_AI_MODEL (live CAPTCHA solve)
 *   HEADLESS=1 (or --headless) — recommended for PDF generation
 *   BROWSER_PROFILE_DIR — persistent Chrome profile (default ~/.cache/...)
 *   ARTIFACT_DIR — where PDFs are saved (default .local/artifacts)
 */

import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

import { browserAutomation } from "../src/browser-automation/index.ts";
import { fetchPuccCertificateDirect } from "../src/browser-automation/workflows/pucc.ts";
import { fetchTransactionHistoryDirect } from "../src/browser-automation/workflows/vahan-transaction-history.ts";

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

async function main(): Promise<void> {
	const command = process.argv[2];
	if (command !== "pucc" && command !== "transaction-history") {
		console.error(
			"Usage: bun scripts/run-workflow.ts pucc --reg <REG> --chassis <LAST5> [--headless] [--mock-captcha CODE] [--timeout-ms N] [--max-attempts N]",
		);
		console.error(
			"   or: bun scripts/run-workflow.ts transaction-history --reg <REG> [--headless] [--mock-captcha CODE] [--timeout-ms N] [--max-attempts N]",
		);
		process.exit(1);
	}
	if (command === "transaction-history") {
		await runTransactionHistory();
		return;
	}
	const reg = argValue("reg") ?? argValue("registration");
	const chassis = argValue("chassis") ?? argValue("chassis-last5");
	if (!reg || !chassis) {
		console.error("Missing required args: --reg <REG> --chassis <LAST5>");
		process.exit(1);
	}
	if (hasFlag("headless")) process.env.HEADLESS = "1";

	const mockCaptcha = argValue("mock-captcha")?.trim();
	const timeoutMs = Number(argValue("timeout-ms") ?? "") || undefined;
	const maxCaptchaAttempts =
		Number(argValue("max-attempts") ?? "") || undefined;

	console.log(
		`[workflow:cli] pucc reg=${reg} chassis=***${chassis.slice(-2)} headless=${process.env.HEADLESS ?? "0"}`,
	);
	try {
		const output = await fetchPuccCertificateDirect(
			{
				chassisLast5: chassis,
				registrationNumber: reg,
				...(maxCaptchaAttempts !== undefined ? { maxCaptchaAttempts } : {}),
				...(timeoutMs !== undefined ? { timeoutMs } : {}),
			},
			mockCaptcha
				? {
						captchaSolver: async () => ({
							code: mockCaptcha,
							confidence: 1,
							raw: mockCaptcha,
						}),
						log: (...args: unknown[]) => console.log("[pucc:cli]", ...args),
					}
				: {
						log: (...args: unknown[]) => console.log("[pucc:cli]", ...args),
					},
		);
		console.log("[workflow:cli] succeeded:");
		console.log(JSON.stringify(output, null, 2));
	} catch (err) {
		console.error("[workflow:cli] failed:");
		console.error(err instanceof Error ? (err.stack ?? err.message) : err);
		process.exitCode = 1;
	} finally {
		await browserAutomation.close().catch(() => {});
		// Patchright can leave handles open; force exit like the app's cleanup.
		process.exit(process.exitCode ?? 0);
	}
}

async function runTransactionHistory(): Promise<void> {
	const reg = argValue("reg") ?? argValue("registration");
	if (!reg) {
		console.error("Missing required args: --reg <REG>");
		process.exit(1);
	}
	if (hasFlag("headless")) process.env.HEADLESS = "1";

	const mockCaptcha = argValue("mock-captcha")?.trim();
	const timeoutMs = Number(argValue("timeout-ms") ?? "") || undefined;
	const maxCaptchaAttempts =
		Number(argValue("max-attempts") ?? "") || undefined;

	console.log(
		`[workflow:cli] transaction-history reg=${reg} headless=${process.env.HEADLESS ?? "0"}`,
	);
	try {
		const output = await fetchTransactionHistoryDirect(
			{
				registrationNumber: reg,
				...(maxCaptchaAttempts !== undefined ? { maxCaptchaAttempts } : {}),
				...(timeoutMs !== undefined ? { timeoutMs } : {}),
			},
			mockCaptcha
				? {
						captchaSolver: async () => ({
							code: mockCaptcha,
							confidence: 1,
							raw: mockCaptcha,
						}),
						log: (...args: unknown[]) => console.log("[vahan-tx:cli]", ...args),
					}
				: {
						log: (...args: unknown[]) => console.log("[vahan-tx:cli]", ...args),
					},
		);
		console.log("[workflow:cli] succeeded:");
		console.log(JSON.stringify(output, null, 2));
	} catch (err) {
		console.error("[workflow:cli] failed:");
		console.error(err instanceof Error ? (err.stack ?? err.message) : err);
		process.exitCode = 1;
	} finally {
		await browserAutomation.close().catch(() => {});
		process.exit(process.exitCode ?? 0);
	}
}

void main();
