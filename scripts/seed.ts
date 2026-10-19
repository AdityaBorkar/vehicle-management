import { randomUUID } from "node:crypto";

import * as p from "@clack/prompts";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db-schema/index.ts";
import { normalizePhoneNumber } from "../src/lib/phone.ts";

config({ path: [".env.local", ".env"] });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL is not set. Check your .env.local file.");
	process.exit(1);
}
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

async function findUniqueSlug(baseSlug: string): Promise<string> {
	let candidate = baseSlug || `org-${randomUUID().slice(0, 8).toLowerCase()}`;
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const existing = await db
			.select({ id: schema.organizations.id })
			.from(schema.organizations)
			.where(eq(schema.organizations.slug, candidate))
			.limit(1);
		if (existing.length === 0) {
			return candidate;
		}
		candidate = `${baseSlug}-${randomUUID().slice(0, 6).toLowerCase()}`;
	}
	throw new Error(`Could not generate a unique slug for base "${baseSlug}".`);
}

async function main() {
	p.intro("Admin Seed");

	try {
		const nameInput = await p.text({
			message: "Admin name:",
			validate: (value) =>
				!(value ?? "").trim() ? "Admin name is required." : undefined,
		});
		if (p.isCancel(nameInput)) {
			p.cancel("Seed cancelled.");
			process.exitCode = 1;
			return;
		}

		const emailInput = await p.text({
			message: "Admin email:",
			validate: (value) => {
				const email = (value ?? "").trim().toLowerCase();
				if (!email) {
					return "Admin email is required.";
				}
				if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
					return "Enter a valid email address.";
				}
				return undefined;
			},
		});
		if (p.isCancel(emailInput)) {
			p.cancel("Seed cancelled.");
			process.exitCode = 1;
			return;
		}

		const phoneInput = await p.text({
			message: "Admin phone number:",
			validate: (value) =>
				!(value ?? "").trim() ? "Admin phone number is required." : undefined,
		});
		if (p.isCancel(phoneInput)) {
			p.cancel("Seed cancelled.");
			process.exitCode = 1;
			return;
		}

		const orgInput = await p.text({
			message: "Organization name:",
			validate: (value) =>
				!(value ?? "").trim() ? "Organization name is required." : undefined,
		});
		if (p.isCancel(orgInput)) {
			p.cancel("Seed cancelled.");
			process.exitCode = 1;
			return;
		}

		const name = nameInput.trim();
		const email = emailInput.trim().toLowerCase();
		const phone = normalizePhoneNumber(phoneInput.trim());
		const orgName = orgInput.trim();

		const [existingEmail, existingPhone] = await Promise.all([
			db
				.select({ id: schema.users.id })
				.from(schema.users)
				.where(eq(schema.users.email, email))
				.limit(1),
			db
				.select({ id: schema.users.id })
				.from(schema.users)
				.where(eq(schema.users.phoneNumber, phone))
				.limit(1),
		]);

		if (existingEmail.length > 0) {
			p.log.warn(
				`User with email "${email}" already exists (id: ${existingEmail[0]?.id}). Skipping user creation.`,
			);
			p.outro("Done — no changes made.");
			return;
		}

		if (existingPhone.length > 0) {
			p.log.error(
				`User with phone number "${phone}" already exists (id: ${existingPhone[0]?.id}). Aborting.`,
			);
			process.exitCode = 1;
			return;
		}

		const orgSlug = await findUniqueSlug(slugify(orgName));

		const userId = randomUUID();
		const orgId = randomUUID();
		const memberId = randomUUID();
		const now = new Date();

		await db.transaction(async (tx) => {
			await tx.insert(schema.users).values({
				createdAt: now,
				email,
				emailVerified: true,
				id: userId,
				name,
				phoneNumber: phone,
				phoneNumberVerified: true,
				updatedAt: now,
			});

			await tx.insert(schema.organizations).values({
				createdAt: now,
				id: orgId,
				name: orgName,
				slug: orgSlug,
			});

			await tx.insert(schema.members).values({
				createdAt: now,
				id: memberId,
				organizationId: orgId,
				role: "owner",
				userId,
			});
		});

		p.log.success(`User:         ${name} (${email})`);
		p.log.success(`Phone:        ${phone}`);
		p.log.success(`User ID:      ${userId}`);
		p.log.success(`Organization: ${orgName} (${orgSlug})`);
		p.log.success(`Org ID:       ${orgId}`);
		p.log.success("Member role:  owner");
		p.outro("Seeded successfully.");
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	p.log.error("Seed failed.");
	console.error(err);
	process.exitCode = 1;
});
