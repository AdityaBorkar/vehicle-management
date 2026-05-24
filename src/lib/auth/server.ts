import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization, phoneNumber } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import * as schema from "@/db-schema";
import { db } from "@/lib/db/server";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          throw new APIError("BAD_REQUEST", {
            message: "Signups are disabled",
          });
        },
      },
    },
  },
  plugins: [
    phoneNumber({
      sendOTP: ({ phoneNumber, code }) => {
        console.log(`[OTP] phone=${phoneNumber} code=${code}`);
      },
    }),
    organization(),
    tanstackStartCookies(),
  ],
});
