import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization, phoneNumber } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import * as schema from "#/db-schema";
import { db } from "#/lib/db";
import { isValidPhoneNumber } from "#/lib/utils";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		schemaName: "auth",
		transaction: true,
		usePlural: true,
	}),
	databaseHooks: {
		user: {
			create: {
				before: () => {
					throw new APIError("BAD_REQUEST", {
						message: "Signups are disabled",
					});
				},
			},
		},
	},
	plugins: [
		expo(),
		phoneNumber({
			phoneNumberValidator: (phone) => isValidPhoneNumber(phone),
			sendOTP: ({ phoneNumber: phone, code }) => {
				if (process.env.NODE_ENV !== "production") {
					console.log(`[OTP] phone=${phone} code=${code}`);
				}
			},
		}),
		organization(),
		tanstackStartCookies(),
	],
	trustedOrigins: [
		"vasundhara://",
		// Development mode - Expo's exp:// scheme with local IP ranges
		...(process.env.NODE_ENV === "development"
			? [
					"exp://", // Trust all Expo URLs (prefix matching)
					"exp://**", // Trust all Expo URLs (wildcard matching)
					"exp://192.168.*.*:*/**", // Trust 192.168.x.x IP range with any port and path
				]
			: []),
	],
});
