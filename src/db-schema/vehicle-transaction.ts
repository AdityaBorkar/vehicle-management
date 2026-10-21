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
 * Latest Vahan "Know Your Application Status" snapshot per vehicle.
 *
 * Refreshed by the `vahan-transaction-history` browser workflow
 * (Vahan login → Status → Know Your Application Status → Vehicle Number
 * radio → registration number → CAPTCHA → Submit). Each refresh replaces
 * the previous snapshot for the vehicle so the Transaction History tab
 * always shows the latest portal state; the `workflow_runs` table keeps
 * the audit trail of every fetch.
 */
export const vehicleTransactions = pgTable("vehicle_transactions", {
	applicationNumber: text("application_number"),
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	fetchedAt: timestamp("fetched_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	id: serial().primaryKey(),
	raw: jsonb("raw").$type<Record<string, string> | null>(),
	registrationNumber: text("registration_number").notNull(),
	remarks: text(),
	serviceType: text("service_type"),
	status: text(),
	transactionDate: timestamp("transaction_date", {
		mode: "date",
		withTimezone: true,
	}),
	updatedAt: timestamp("updated_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	userId: text("user_id").notNull(),
	vehicleId: integer("vehicle_id")
		.notNull()
		.references(() => vehicles.id, { onDelete: "cascade" }),
});

export type VehicleTransactionRow = typeof vehicleTransactions.$inferSelect;
export type VehicleTransactionInsert = typeof vehicleTransactions.$inferInsert;
