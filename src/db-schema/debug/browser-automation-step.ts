import { integer, serial, text, timestamp } from "drizzle-orm/pg-core";

import { workflowRuns } from "../workflow-run";
import { debugSchema } from "./schema";

export const browserAutomationSteps = debugSchema.table(
	"browser_automation_steps",
	{
		attempt: integer().default(1).notNull(),
		createdAt: timestamp("created_at", {
			mode: "date",
			withTimezone: true,
		}).defaultNow(),
		finishedAt: timestamp("finished_at", {
			mode: "date",
			withTimezone: true,
		}),
		id: serial().primaryKey(),
		kind: text().notNull(),
		label: text().notNull(),
		message: text(),
		runId: integer("run_id")
			.notNull()
			.references(() => workflowRuns.id, { onDelete: "cascade" }),
		screenshotKey: text("screenshot_key"),
		seq: integer().notNull(),
		startedAt: timestamp("started_at", {
			mode: "date",
			withTimezone: true,
		}).defaultNow(),
		status: text().notNull().default("ok"),
		userId: text("user_id").notNull(),
	},
);

export type BrowserAutomationStepRow =
	typeof browserAutomationSteps.$inferSelect;
