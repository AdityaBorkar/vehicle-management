import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const drivers = pgTable("drivers", {
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	id: serial().primaryKey(),
	name: text().notNull(),
	phoneNumber: text("phone_number"),
	updatedAt: timestamp("updated_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	userId: text("user_id").notNull(),
});
