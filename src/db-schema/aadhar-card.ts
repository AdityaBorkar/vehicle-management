import {
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { drivers } from "./driver";

export const aadharCards = pgTable(
	"aadhar_cards",
	{
		aadharNumber: text("aadhar_number").notNull(),
		address: text(),
		createdAt: timestamp("created_at", {
			mode: "date",
			withTimezone: true,
		}).defaultNow(),
		dateOfBirth: timestamp("date_of_birth", {
			mode: "date",
			withTimezone: true,
		}),
		driverId: integer("driver_id")
			.notNull()
			.references(() => drivers.id, { onDelete: "cascade" }),
		gender: text(),
		id: serial().primaryKey(),
		updatedAt: timestamp("updated_at", {
			mode: "date",
			withTimezone: true,
		}).defaultNow(),
	},
	(t) => [uniqueIndex("aadhar_number_unique").on(t.aadharNumber)],
);
