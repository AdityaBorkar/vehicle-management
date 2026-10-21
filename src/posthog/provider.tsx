import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import { type ReactNode, useEffect } from "react";

import { env } from "#/env";

export default function PostHogProvider({ children }: { children: ReactNode }) {
	useEffect(() => {
		if (typeof window !== "undefined") {
			posthog.init(env.PUBLIC_POSTHOG_KEY, {
				api_host: env.PUBLIC_POSTHOG_HOST,
				capture_pageview: false,
				// defaults: "2025-11-30",
				// person_profiles: "identified_only",
			});
		}
	}, []);
	return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>;
}
