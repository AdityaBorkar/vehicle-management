import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { verifications } from "#/db-schema";
import { db } from "#/lib/db";
import { normalizePhoneNumber } from "#/lib/utils";

/**
 * Dev-only better-auth mocking helper.
 *
 * The phone-number plugin only `console.log`s OTP codes on the server, which
 * makes manual QA of every endpoint painful. In development, the login page
 * sends a real OTP via better-auth and then calls this function to read the
 * pending code back so it can autofill (or one-click verify) it.
 *
 * Refuses to run in production builds.
 */
export const getDevOtpCode = createServerFn({ method: "GET" })
	.validator(z.object({ phoneNumber: z.string().min(1) }))
	.handler(async ({ data }) => {
		if (process.env.NODE_ENV === "production") {
			throw new Error("Dev-only endpoint");
		}
		const phone = normalizePhoneNumber(data.phoneNumber);
		const rows = await db
			.select()
			.from(verifications)
			.where(eq(verifications.identifier, phone))
			.orderBy(desc(verifications.updatedAt))
			.limit(1);
		const row = rows[0];
		if (!row) {
			throw new Error("No OTP found. Send an OTP first.");
		}
		if (row.expiresAt < new Date()) {
			throw new Error("OTP expired. Send a new one.");
		}
		const code = row.value.split(":")[0];
		if (!code) {
			throw new Error("Could not read OTP code.");
		}
		return { code };
	});
