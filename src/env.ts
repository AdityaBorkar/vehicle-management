import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    PUBLIC_APP_TITLE: z.string().min(1).optional(),
  },
  clientPrefix: "PUBLIC_",
  emptyStringAsUndefined: true,
  runtimeEnv: typeof window === "undefined" ? process.env : import.meta.env,
  server: {
    SERVER_URL: z.url().optional(),
  },
});
