import { RPCHandler } from "@orpc/server/fetch";
import { createFileRoute } from "@tanstack/react-router";

import { router } from "#/rpc/router";

const handler = new RPCHandler(router);

async function handleRequest(request: Request) {
  const { response } = await handler.handle(request, {
    context: { headers: request.headers },
    prefix: "/api/rpc",
  });
  return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      DELETE: ({ request }) => handleRequest(request),
      GET: ({ request }) => handleRequest(request),
      PATCH: ({ request }) => handleRequest(request),
      POST: ({ request }) => handleRequest(request),
      PUT: ({ request }) => handleRequest(request),
    },
  },
});
