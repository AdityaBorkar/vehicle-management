import {
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

/**
 * Cache / audit log of third-party API calls (billed per call).
 *
 * Rows are shared across users: RC data comes from the public VAHAN
 * register, so a cached response for one user is valid for all of them
 * and saves a paid API call. Rows are never updated — every live call
 * inserts a fresh row, so the full request/response history is preserved.
 */
export const externalApiCalls = pgTable("external_api_calls", {
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	endpoint: text().notNull(),
	id: serial().primaryKey(),
	provider: text().notNull().default("apiexpress"),
	request: jsonb("request").$type<Record<string, unknown>>().notNull(),
	response: jsonb("response").$type<Record<string, unknown> | null>(),
	status: text().notNull().default("success"),
	statusCode: integer("status_code"),
	vin: text().notNull(),
});
