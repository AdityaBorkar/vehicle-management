import {
	integer,
	jsonb,
	real,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { workflowRuns } from "../workflow-run";
import { debugSchema } from "./schema";

export const llmRequests = debugSchema.table("llm_requests", {
	confidence: real(),
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	error: text(),
	id: serial().primaryKey(),
	imageKey: text("image_key"),
	latencyMs: integer("latency_ms"),
	model: text().notNull(),
	parsedCode: text("parsed_code"),
	prompt: text().notNull(),
	provider: text().notNull().default("meta-ai"),
	purpose: text().notNull().default("captcha-solve"),
	request: jsonb("request").$type<Record<string, unknown>>().notNull(),
	response: jsonb("response").$type<Record<string, unknown> | null>(),
	runId: integer("run_id").references(() => workflowRuns.id, {
		onDelete: "cascade",
	}),
	status: text().notNull().default("success"),
	userId: text("user_id").notNull(),
});

export type LlmRequestRow = typeof llmRequests.$inferSelect;
