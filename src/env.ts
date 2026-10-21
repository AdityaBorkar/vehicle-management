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
		ARTIFACT_DIR: z.string().optional(),
		BETTER_AUTH_SECRET: z.string().min(1),
		BETTER_AUTH_URL: z.url(),
		DATABASE_URL: z.url(),
		RUSTFS_ACCESS_KEY: z.string().optional(),
		RUSTFS_BUCKET_ARTIFACTS: z.string().optional(),
		RUSTFS_BUCKET_DOCUMENTS: z.string().optional(),
		RUSTFS_ENDPOINT: z.string().optional(),
		RUSTFS_REGION: z.string().optional(),
		RUSTFS_SECRET_KEY: z.string().optional(),
	},
});
