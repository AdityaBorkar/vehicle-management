import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";

import type { Router } from "@/rpc/router";

const link = new RPCLink({
  headers: () => ({
    cookie: typeof document !== "undefined" ? document.cookie : "",
  }),
  url: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3010"}/api/rpc`,
});

export const client: RouterClient<Router> = createORPCClient(link);
