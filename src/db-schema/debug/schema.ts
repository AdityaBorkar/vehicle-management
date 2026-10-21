import { pgSchema } from "drizzle-orm/pg-core";

/** Single shared instance for the `debug` schema (Spec 02 observability). */
export const debugSchema = pgSchema("debug");
