import {
	boolean,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { drivers } from "./driver";
import { drivingLicenses } from "./driving-license";
import { vehicles } from "./vehicle";

/**
 * Append-only vault of every document ever held.
 *
 * Rows are never deleted. Renewing a document marks the previous row
 * `superseded` and inserts a fresh `active` row, so the full history —
 * issue date, expiry date, document name and VIN / DL number — is always
 * preserved. Archiving only flips `status`; the row stays.
 */
export const documents = pgTable("documents", {
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	documentName: text("document_name").notNull(),
	documentNumber: text("document_number"),
	driverId: integer("driver_id").references(() => drivers.id, {
		onDelete: "set null",
	}),
	driverName: text("driver_name"),
	expiryDate: timestamp("expiry_date", {
		mode: "date",
		withTimezone: true,
	}),
	id: serial().primaryKey(),
	isCurrent: boolean("is_current").default(true),
	issueDate: timestamp("issue_date", {
		mode: "date",
		withTimezone: true,
	}),
	kind: text().notNull(),
	licenseId: integer("license_id").references(() => drivingLicenses.id, {
		onDelete: "set null",
	}),
	licenseNumber: text("license_number"),
	notes: text(),
	status: text().default("active"),
	updatedAt: timestamp("updated_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	userId: text("user_id").notNull(),
	vehicleId: integer("vehicle_id").references(() => vehicles.id, {
		onDelete: "set null",
	}),
	vehicleRegistration: text("vehicle_registration"),
	vin: text(),
});
