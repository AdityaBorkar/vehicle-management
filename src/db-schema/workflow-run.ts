import {
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { vehicles } from "./vehicle";

/**
 * Durable record of every async workflow run.
 *
 * The workflows engine (`#/browser-automation/engine`) enqueues a row with
 * status `queued`, claims it in the background, flips it to `running`, then
 * to a terminal `succeeded` / `failed` state with the output or error.
 *
 * Rows are never deleted — they are the audit log for billed browser
 * automations (PUCC fetch, challan scrape, …). Artifacts (PDFs) live on
 * disk via the artifact store; `artifactPath` points at the file so a
 * future S3 migration only needs to swap the store implementation.
 */
export const workflowRuns = pgTable("workflow_runs", {
	artifactPath: text("artifact_path"),
	attempts: integer().default(0).notNull(),
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	error: text(),
	finishedAt: timestamp("finished_at", {
		mode: "date",
		withTimezone: true,
	}),
	id: serial().primaryKey(),
	input: jsonb("input").$type<Record<string, unknown>>().notNull(),
	output: jsonb("output").$type<Record<string, unknown> | null>(),
	startedAt: timestamp("started_at", {
		mode: "date",
		withTimezone: true,
	}),
	status: text().notNull().default("queued"),
	updatedAt: timestamp("updated_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	userId: text("user_id").notNull(),
	vehicleId: integer("vehicle_id").references(() => vehicles.id, {
		onDelete: "set null",
	}),
	workflowName: text("workflow_name").notNull(),
});

export type WorkflowRunRow = typeof workflowRuns.$inferSelect;
export type WorkflowRunInsert = typeof workflowRuns.$inferInsert;
