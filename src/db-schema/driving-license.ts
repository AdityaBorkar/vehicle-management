import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const drivingLicenses = pgTable(
  "driving_licenses",
  {
    address: text(),
    bloodGroup: text("blood_group"),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    }).defaultNow(),
    dateOfBirth: timestamp("date_of_birth", {
      mode: "date",
      withTimezone: true,
    }),
    expiryDate: timestamp("expiry_date", {
      mode: "date",
      withTimezone: true,
    }),
    holderName: text("holder_name").notNull(),
    id: serial().primaryKey(),
    issueDate: timestamp("issue_date", {
      mode: "date",
      withTimezone: true,
    }),
    licenseNumber: text("license_number").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    }).defaultNow(),
    userId: text("user_id").notNull(),
    vehicleClasses: text("vehicle_classes"),
  },
  (t) => [uniqueIndex("licenses_number_unique").on(t.licenseNumber)],
);
