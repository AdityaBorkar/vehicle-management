import { createInterface } from "node:readline/promises";

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "../src/db-schema/index.ts";

config({ path: [".env.local", ".env"] });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL is not set. Check your .env.local file.");
	process.exit(1);
}
const db = drizzle(DATABASE_URL, { schema });

function prompt(
	rl: ReturnType<typeof createInterface>,
	question: string,
): Promise<string> {
	return rl.question(question);
}

function generateId(): string {
	return crypto.randomUUID();
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

async function main() {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log("\n=== Admin Seed Script ===\n");

	const name = await prompt(rl, "Admin name: ");
	const email = await prompt(rl, "Admin email: ");
	const phone = await prompt(rl, "Admin phone number: ");
	const orgName = await prompt(rl, "Organization name: ");

	rl.close();

	if (!name || !email || !phone || !orgName) {
		console.error("All fields are required.");
		process.exit(1);
	}

	const userId = generateId();
	const orgId = generateId();
	const memberId = generateId();
	const orgSlug = slugify(orgName);

	const existingUser = await db
		.select()
		.from(schema.users)
		.where(eq(schema.users.email, email))
		.limit(1);

	if (existingUser.length > 0) {
		console.log(
			`\nUser with email "${email}" already exists (id: ${existingUser[0]?.id}). Skipping user creation.`,
		);
		console.log("\nDone.");
		process.exit(0);
	}

	await db.insert(schema.users).values({
		email,
		emailVerified: true,
		id: userId,
		name,
		phoneNumber: phone,
		phoneNumberVerified: true,
	});

	await db.insert(schema.organizations).values({
		id: orgId,
		name: orgName,
		slug: orgSlug,
	});

	await db.insert(schema.members).values({
		id: memberId,
		organizationId: orgId,
		role: "owner",
		userId,
	});

	console.log("\n=== Seeded successfully ===");
	console.log(`  User:          ${name} (${email})`);
	console.log(`  Phone:         ${phone}`);
	console.log(`  User ID:       ${userId}`);
	console.log(`  Organization:  ${orgName} (${orgSlug})`);
	console.log(`  Org ID:        ${orgId}`);
	console.log(`  Member role:   owner`);
	console.log("");

	process.exit(0);
}

main().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
