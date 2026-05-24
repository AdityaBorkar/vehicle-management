import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  email: text().notNull(),
  emailVerified: boolean("email_verified").default(false),
  id: text().primaryKey(),
  image: text(),
  name: text().notNull(),
  phoneNumber: text("phone_number"),
  phoneNumberVerified: boolean("phone_number_verified").default(false),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
});

export const sessions = pgTable("sessions", {
  activeOrganizationId: text("active_organization_id"),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  expiresAt: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  id: text().primaryKey(),
  ipAddress: text("ip_address"),
  token: text().notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull(),
});

export const accounts = pgTable("accounts", {
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    mode: "date",
    withTimezone: true,
  }),
  accountId: text("account_id").notNull(),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  id: text().primaryKey(),
  idToken: text("id_token"),
  password: text(),
  providerId: text("provider_id").notNull(),
  refreshToken: text("refresh_token"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    mode: "date",
    withTimezone: true,
  }),
  scope: text(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  userId: text("user_id").notNull(),
});

export const verifications = pgTable("verifications", {
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  expiresAt: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  id: text().primaryKey(),
  identifier: text().notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),
  value: text().notNull(),
});
