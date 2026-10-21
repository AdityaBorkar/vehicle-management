import { integer, text, timestamp } from "drizzle-orm/pg-core";

import { vehicles } from "../vehicle";
import { workflowRuns } from "../workflow-run";
import { debugSchema } from "./schema";

export const workflowDebugs = debugSchema.table("workflows", {
	completedAt: timestamp("finished_at", {
		mode: "date",
		withTimezone: true,
	}),
	consoleLogKey: text("console_log_key"),
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	errorCount: integer("error_count").default(0).notNull(),
	runId: integer("run_id")
		.primaryKey()
		.references(() => workflowRuns.id, { onDelete: "cascade" }),
	startedAt: timestamp("started_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	status: text().notNull().default("queued"),
	userId: text("user_id").notNull(),
	vehicleId: integer("vehicle_id").references(() => vehicles.id, {
		onDelete: "set null",
	}),
	videoKey: text("video_key"),
	warningCount: integer("warning_count").default(0).notNull(),
	workflowName: text("workflow_name").notNull(),
});

export type WorkflowDebugRow = typeof workflowDebugs.$inferSelect;
