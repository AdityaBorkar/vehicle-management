import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "@/db-schema";

// biome-ignore lint/complexity/useLiteralKeys: process.env requires bracket notation under noPropertyAccessFromIndexSignature
export const db = drizzle(process.env["DATABASE_URL"] || "", { schema });
