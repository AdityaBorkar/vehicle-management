import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// TODO: REPLACE WITH PULUMI INJECTION
config({ path: [".env.local", ".env"] });

export default defineConfig({
	dbCredentials: {
		url: process.env.DATABASE_URL || "",
	},
	dialect: "postgresql",
	out: "./drizzle",
	schema: "./src/db-schema/index.ts",
	schemaFilter: ["public", "auth"],
});
