import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"] });

export default defineConfig({
  dbCredentials: {
    // biome-ignore lint/complexity/useLiteralKeys: process.env requires bracket notation under noPropertyAccessFromIndexSignature
    url: process.env["DATABASE_URL"] || "",
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/db-schema/index.ts",
});
