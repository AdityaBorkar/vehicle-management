import {
	index,
	integer,
	jsonb,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { workflowRuns } from "../workflow-run";
import { debugSchema } from "./schema";

export const debugLogs = debugSchema.table(
	"logs",
	{
		createdAt: timestamp("created_at", {
			mode: "date",
			withTimezone: true,
		}).defaultNow(),
		id: serial().primaryKey(),
		level: text().notNull().default("info"),
		message: text().notNull(),
		meta: jsonb("meta").$type<Record<string, unknown> | null>(),
		runId: integer("run_id")
			.notNull()
			.references(() => workflowRuns.id, { onDelete: "cascade" }),
		source: text().notNull().default("workflow"),
		userId: text("user_id").notNull(),
	},
	(t) => [index("logs_run_created_idx").on(t.runId, t.createdAt)],
);

export type DebugLogRow = typeof debugLogs.$inferSelect;
