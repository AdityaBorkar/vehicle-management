import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { vehicles } from "./vehicle";

export const gpsDevices = pgTable("gps_devices", {
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  deviceId: text("device_id").notNull(),
  id: serial().primaryKey(),
  isActive: boolean("is_active").default(true),
  provider: text(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
});

export const fastags = pgTable("fastags", {
  balance: text("balance").default("0"),
  bankWallet: text("bank_wallet"),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  id: serial().primaryKey(),
  isActive: boolean("is_active").default(true),
  tagId: text("tag_id").notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
});

export const dieselCards = pgTable("diesel_cards", {
  balance: text("balance").default("0"),
  cardNumber: text("card_number").notNull(),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  id: serial().primaryKey(),
  isActive: boolean("is_active").default(true),
  provider: text(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
});
