import {
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { drivingLicenses } from "./driving-license";
import { vehicles } from "./vehicle";

export const reminders = pgTable("reminders", {
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  dueDate: timestamp("due_date", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  id: serial().primaryKey(),
  licenseId: integer("license_id").references(() => drivingLicenses.id, {
    onDelete: "set null",
  }),
  notifyDays: json("notify_days").$type<number[]>().default([0, 1, 3, 7, 14]),
  status: text().default("active"),
  title: text().notNull(),
  type: text().notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  userId: text("user_id").notNull(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id, {
    onDelete: "set null",
  }),
});
