import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { drivingLicenses } from "./driving-license";

export const dlVehicleClasses = pgTable("dl_vehicle_classes", {
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	expiryDate: timestamp("expiry_date", {
		mode: "date",
		withTimezone: true,
	}).notNull(),
	id: serial().primaryKey(),
	licenseId: integer("license_id")
		.notNull()
		.references(() => drivingLicenses.id, { onDelete: "cascade" }),
	updatedAt: timestamp("updated_at", {
		mode: "date",
		withTimezone: true,
	}).defaultNow(),
	vehicleClass: text("vehicle_class").notNull(),
});
