import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { vehicles } from "./vehicle";

export const challans = pgTable(
  "challans",
  {
    challanNumber: text("challan_number").notNull(),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    }).defaultNow(),
    fineAmount: integer("fine_amount").notNull(),
    id: serial().primaryKey(),
    issuingAuthority: text("issuing_authority"),
    location: text(),
    offense: text().notNull(),
    offenseDate: timestamp("offense_date", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    paymentDate: timestamp("payment_date", {
      mode: "date",
      withTimezone: true,
    }),
    status: text().default("pending"),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    }).defaultNow(),
    userId: text("user_id").notNull(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("challan_number_unique").on(t.challanNumber)],
);
