import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import { type ReactNode, useEffect, useRef } from "react";

import { env } from "#/env";

export default function AnalyticsProvider({
	children,
}: {
	children: ReactNode;
}): ReactNode {
	const initialized = useRef(false);

	useEffect(() => {
		if (initialized.current) return;
		initialized.current = true;
		posthog.init(env.PUBLIC_POSTHOG_KEY, {
			api_host: env.PUBLIC_POSTHOG_HOST,
			capture_pageview: false,
		});
	}, []);

	return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>;
}
