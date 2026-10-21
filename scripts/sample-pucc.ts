/**
 * One-off sample runner: enqueues a real PUCC fetch for a vehicle and waits
 * for the engine to finish it (same path the UI button uses).
 *
 * Usage:
 *   HEADLESS=1 bun scripts/sample-pucc.ts --reg MH11CH7041 --chassis 04198 --vehicle 3 --user <userId>
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

import {
	enqueueWorkflowRun,
	getWorkflowRun,
} from "../src/browser-automation/engine.ts";
import "../src/browser-automation/workflows/pucc.ts";
import { PUCC_WORKFLOW_NAME } from "../src/browser-automation/workflows/pucc.ts";

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

const registrationNumber = argValue("reg") ?? "";
const chassisLast5 = argValue("chassis") ?? "";
const vehicleId = Number(argValue("vehicle") ?? "");
const userId = argValue("user") ?? "";
if (!registrationNumber || !chassisLast5 || !vehicleId || !userId) {
	console.error(
		"Usage: bun scripts/sample-pucc.ts --reg <REG> --chassis <LAST5> --vehicle <ID> --user <USERID>",
	);
	process.exit(1);
}

const run = await enqueueWorkflowRun({
	input: { chassisLast5, registrationNumber, vehicleId },
	userId,
	vehicleId,
	workflowName: PUCC_WORKFLOW_NAME,
});
console.log(`enqueued run #${run.id} for ${registrationNumber}`);

const deadline = Date.now() + 10 * 60 * 1000;
for (;;) {
	await new Promise((r) => setTimeout(r, 5000));
	const current = await getWorkflowRun(run.id, userId);
	console.log(
		`[${new Date().toISOString()}] status=${current?.status} attempts=${current?.attempts}`,
	);
	if (
		!current ||
		current.status === "succeeded" ||
		current.status === "failed"
	) {
		console.log(JSON.stringify(current, null, 2));
		process.exit(current?.status === "succeeded" ? 0 : 1);
	}
	if (Date.now() > deadline) {
		console.error("Timed out waiting for the run.");
		process.exit(2);
	}
}
