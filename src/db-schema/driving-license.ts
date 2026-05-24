import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { drivers } from "./driver";

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
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
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
  },
  (t) => [uniqueIndex("licenses_number_unique").on(t.licenseNumber)],
);
