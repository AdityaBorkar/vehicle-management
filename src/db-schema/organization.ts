import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const organizations = pgTable("organizations", {
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	id: text().primaryKey(),
	logo: text(),
	name: text().notNull(),
	slug: text().notNull(),
	updatedAt: timestamp("updated_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
});

export const members = pgTable("members", {
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	id: text().primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	role: text().notNull().default("member"),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

export const invitations = pgTable("invitations", {
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	email: text().notNull(),
	expiresAt: timestamp("expires_at", {
		mode: "date",
		withTimezone: true,
	}),
	id: text().primaryKey(),
	inviterId: text("inviter_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	role: text().notNull(),
	status: text().notNull().default("pending"),
});
