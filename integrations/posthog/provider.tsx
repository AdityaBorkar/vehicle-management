import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import type { ReactNode } from "react";

// biome-ignore lint/complexity/useLiteralKeys: import.meta.env requires bracket notation under noPropertyAccessFromIndexSignature
if (typeof window !== "undefined" && import.meta.env["PUBLIC_POSTHOG_KEY"]) {
  // biome-ignore lint/complexity/useLiteralKeys: import.meta.env requires bracket notation under noPropertyAccessFromIndexSignature
  posthog.init(import.meta.env["PUBLIC_POSTHOG_KEY"], {
    api_host:
      // biome-ignore lint/complexity/useLiteralKeys: import.meta.env requires bracket notation under noPropertyAccessFromIndexSignature
      import.meta.env["PUBLIC_POSTHOG_HOST"] || "https://us.i.posthog.com",
    capture_pageview: false,
    defaults: "2025-11-30",
    person_profiles: "identified_only",
  });
}

interface PostHogProviderProps {
  children: ReactNode;
}

export default function PostHogProvider({ children }: PostHogProviderProps) {
  return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>;
}
