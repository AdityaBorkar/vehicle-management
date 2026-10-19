# AGENTS.md

## Commands

Runtime is Bun (`bun.lock`, `bunfig.toml` `[run] bun = true`). Run scripts with `bun run <name>`:

```
bun run dev           # vite dev --host, port 3000 (strictPort)
bun run build         # vite build -> .output/
bun run check:lint    # biome check --fix (lints, formats, organizes imports)
bun run check:types   # bun check --noEmit (verbatim from package.json, not tsc)
bun run test          # vitest run (no test files exist yet)
bun run db:push       # drizzle-kit push, no migration files
bun run db:studio     # drizzle-kit studio
bun run dev:seed      # bun scripts/seed.ts (name is dev:seed, not db:seed)
```

## Architecture

- **TanStack Start** file-based routing in `src/routes/`. `src/routeTree.gen.ts` is gitignored generated code — never edit.
- **Nitro** via `nitro()` vite plugin; client env vars must use `PUBLIC_` prefix (`envPrefix` in `vite.config.ts`).
- **oRPC**: router at `src/rpc/router.ts` (namespaces: `aadharCard`, `dieselCard`, `driver`, `fastag`, `gpsDevice`, `license`, `reminder`, `vehicle`). `src/rpc/base.ts` exports `authorized` (session-required middleware). Served at `/api/rpc` by `src/routes/api/rpc.$.ts`. Isomorphic client in `src/lib/orpc-client.ts` (server calls router directly, browser uses `RPCLink`); query helpers in `src/lib/orpc-query.ts`.
- **Auth** (Better Auth, `src/lib/auth/server.ts`): `drizzleAdapter` + `expo` / `phoneNumber` / `organization` / `tanstackStartCookies` plugins. Signups are hard-disabled (`databaseHooks.user.create.before` throws). OTP `sendOTP` only `console.log`s the code — read the server log in dev. Client is `src/lib/auth/client.ts`; session fetch is the `getSession` serverFn in `src/routes/api/-auth.ts`. `/` is phone-OTP login (redirects to `/dashboard` when logged in); `src/routes/(app)/route.tsx` redirects unauthenticated users to `/`.
- **DB**: Drizzle + `node-postgres`. Schema barrel is `src/db-schema/index.ts`; instance is `src/lib/db/server.ts` (falls back to `""` if `DATABASE_URL` unset — fails at query time, not import). `drizzle.config.ts` schema is `./src/db-schema/index.ts`.
- **Env**: `src/env.ts` (T3 env) validates `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PUBLIC_POSTHOG_*` but is currently only imported by the (commented-out) PostHog provider. `drizzle.config.ts` and `scripts/seed.ts` load dotenv from `.env.local` then `.env` independently.
- **Styling**: Tailwind v4 + Shadcn (`base-nova`, `zinc`, `tabler` per `components.json`). Real stylesheet is `src/routes/styles.css` (wired via `?url` in `__root.tsx`); `components.json`'s `css: src/styles.css` field is stale and that file does not exist.
- `browser-automation/index.ts` launches Puppeteer with `headless: false` (needs a display); `scrapeChallanDetails` is a stub returning `null`.
- PostHog provider is commented out in `src/routes/__root.tsx` — app runs without PostHog keys.

## Conventions

- Path alias `#/*` → `./src/*` only (`tsconfig.json` + vite `tsconfigPaths`). Root `integrations/` has no alias — do not import it via `#/`.
- Biome defaults: tabs, double quotes; import organization is automatic. `useComponentExportOnlyModules` is disabled for `src/routes/**` and `src/components/**` (route modules export `Route` plus components).
- Strict TS: `noUnusedLocals` / `noUnusedParameters` fail the check; `noUncheckedIndexedAccess` (bracket access is `T | undefined`); `exactOptionalPropertyTypes`; `verbatimModuleSyntax` (use `import type`).
- `src/routes/__root.tsx` `AppShell` renders the sidebar only when a session exists; unauthenticated pages render bare.

## Setup

1. `docker compose up -d` — postgres:18-alpine on :5432, `postgres`/`postgres`/`mydb`, data in `.local/postgres/`
2. Populate `.env.local` (`DATABASE_URL`, `BETTER_AUTH_URL=http://localhost:3000`, `BETTER_AUTH_SECRET`)
3. `bun run db:push`
4. `bunx --bun @better-auth/cli migrate` (no npm script for this)
5. `bun run dev:seed` — prompts for name/email/phone/org, creates user + org + `owner` membership; exits silently if the email already exists

## Gotchas

- Dev port is **3000** (`vite.config.ts`, `strictPort: true` — fails if taken). `BETTER_AUTH_URL` must match the dev origin or auth cookies break.
- `bun run test` passes vacuously — zero test files exist, so a green run proves nothing.
- No `db:generate` / `db:migrate` workflow — schema changes go via `db:push`.
- `infrastructure` note in `drizzle.config.ts` (`TODO: REPLACE WITH PULUMI INJECTION`) — env is still file-based, not injected.
