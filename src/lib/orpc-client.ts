import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import type { Router } from "#/rpc/router";
import { router } from "#/rpc/router";

const getORPCClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(router, {
      context: async () => ({
        headers: getRequestHeaders(),
      }),
    }),
  )
  .client((): RouterClient<Router> => {
    const link = new RPCLink({
      headers: () => ({
        cookie: document.cookie,
      }),
      url: `${window.location.origin}/api/rpc`,
    });

    return createORPCClient(link);
  });

export const client: RouterClient<Router> = getORPCClient();
