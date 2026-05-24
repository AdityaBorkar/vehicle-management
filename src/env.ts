import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    PUBLIC_POSTHOG_HOST: z.string().min(1),
    PUBLIC_POSTHOG_KEY: z.string().min(1),
  },
  clientPrefix: "PUBLIC_",
  emptyStringAsUndefined: true,
  runtimeEnv: typeof window === "undefined" ? process.env : import.meta.env,
  server: {
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url().min(1),
    DATABASE_URL: z.url().min(1),
  },
});
