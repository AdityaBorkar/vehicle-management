# AGENTS.md

## Commands

Runtime is Bun (`bun.lock`). Run scripts with `bun run <name>`:

```
bun run dev           # vite dev --host, port 3000 (strictPort)
bun run build         # vite build -> .output/
bun run check:lint    # biome check --fix (lints, formats, organizes imports)
bun run check:types   # bun check --noEmit (verbatim from package.json, not tsc)
bun run test          # vitest run (zero test files — green proves nothing)
bun run db:push       # drizzle-kit push, no migration files
bun run db:studio     # drizzle-kit studio
bun run dev:seed      # bun scripts/seed.ts (name is dev:seed, not db:seed)
bun run gen:routes    # tsr generate (regen routeTree.gen.ts)
```

`gen:auth-schema` script's `--config ./src/lib/auth/server.ts` path is stale (real file is `./src/lib/auth-server.ts`); pass the corrected config explicitly when regenerating `src/db-schema/auth.gen.ts`.

## Architecture

- **TanStack Start** file routing in `src/routes/`. `*.gen.ts` is gitignored (`src/routeTree.gen.ts`, `src/db-schema/auth.gen.ts`) — never hand-edit.
- **Nitro** via `nitro()` vite plugin; client env vars must use `PUBLIC_` prefix (`envPrefix` in `vite.config.ts`).
- **oRPC**: router at `src/rpc/router.ts` (namespaces `aadharCard`, `dieselCard`, `document`, `driver`, `fastag`, `gpsDevice`, `license`, `reminder`, `vehicle`). Procedures are named exports in `src/rpc/procedures/<kebab-case>.ts` (`document-history.ts`, `vehicle-ownership.ts` are helpers, not router namespaces). `authorized` in `src/rpc/base.ts` enforces session — all procedures use it and scope rows by `userId = context.user.id`. Served at `/api/rpc` by `src/routes/api/rpc.$.ts`. Isomorphic client is `src/lib/rpc.ts` (`client` + `orpc` TanStack utils; server calls router directly, browser uses `RPCLink`).
- **Auth** (Better Auth, `src/lib/auth-server.ts`): `drizzleAdapter` (pg, `auth` schema, plural) + `expo` / `phoneNumber` / `organization` / `tanstackStartCookies` plugins. Signups hard-disabled (`databaseHooks.user.create.before` throws). `sendOTP` only `console.log`s the code; in `DEV` the login page offers "Dev login (autofill OTP)" which reads it back via `getDevOtpCode` in `src/routes/api/-dev.ts` (verifications table, refuses in production). Expo trusted origins include `vasundhara://` plus `exp://` in development. Client is `src/lib/auth-client.ts`; session fetch is the `getSession` serverFn in `src/routes/api/-auth.ts`. `/` is phone-OTP login (redirects to `/dashboard` when logged in); `src/routes/(app)/route.tsx` redirects unauthenticated users to `/`.
- **DB**: Drizzle + `node-postgres`. Barrel is `src/db-schema/index.ts` (auth tables re-exported from generated `auth.gen.ts`); instance is `src/lib/db.ts` (falls back to `""` when `DATABASE_URL` unset — fails at query time, not import). `drizzle.config.ts` schema is `./src/db-schema/index.ts` with `schemaFilter: ["public", "auth"]`.
- **Vehicle lookup**: `vehicle.lookup` takes only a registration number, normalizes via `formatVin` (`src/lib/utils.ts`: uppercase, strip spaces/hyphens, reject non-`[A-Z0-9]`), enforces `/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/` (e.g. `MH01CR7464`). Resolution order: user's `vehicles` row → `external_api_calls` cache → live APIExpress call. APIExpress client is server-only (`src/lib/apiexpress/server.ts`, never import from client components); requires `APIEXPRESS_API_KEY`, retries 429/5xx only, logs every call with VIN + request/response.
- **Phone numbers**: Better Auth matches `phone_number` by exact string, so always normalize with `normalizePhoneNumber` (`src/lib/utils.ts`, E.164, India `+91` default) on write (seed) and login.
- **Env**: `src/env.ts` (T3 env) validates `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PUBLIC_POSTHOG_*` but is currently only imported by the commented-out PostHog provider — validation is not enforced at runtime. `drizzle.config.ts` and `scripts/seed.ts` load dotenv from `.env.local` then `.env` independently.
- **Styling**: Tailwind v4 + Shadcn (`base-nova`, `zinc`, `tabler` per `components.json`). Real stylesheet is `src/routes/styles.css` (wired via `?url` in `__root.tsx`); `components.json`'s `css: src/styles.css` field is stale and that file does not exist.
- **Stubs/empty**: `src/lib/whatsapp/`, `src/lib/cashfree/` (empty dirs), `infra/index.ts` (empty). `browser-automation`: `scrapeChallanDetails` still returns `null`; `scrapeVehicleDetails` works via `workflows/vahan-vehicle-details`. It uses `patchright` with a persistent Chrome profile (`BROWSER_PROFILE_DIR` or `~/.cache/vehicle-management/chrome-profile`), headed by default — set `HEADLESS=1`/`true` for headless; locale `en-IN`, timezone `Asia/Kolkata`.
- PostHog provider is commented out in `src/routes/__root.tsx` — app runs without PostHog keys.

## Conventions

- Path alias `#/*` → `./src/*` only (`tsconfig.json` + vite `tsconfigPaths`).
- Biome defaults: tabs, double quotes; import organization is automatic. `useComponentExportOnlyModules` is disabled for `src/routes/**` and `src/components/**` (route modules export `Route` plus components).
- Strict TS: `noUnusedLocals` / `noUnusedParameters` fail the check; `noUncheckedIndexedAccess` (bracket access is `T | undefined`); `exactOptionalPropertyTypes`; `verbatimModuleSyntax` (use `import type`).
- `src/routes/__root.tsx` `AppShell` renders the sidebar only when a session exists; unauthenticated pages render bare.

## Setup

1. `docker compose up -d` — postgres:18-alpine, host port **5430** → container 5432, `postgres`/`postgres`/`mydb`, data in `.local/postgres/`
2. Populate `.env.local` (`DATABASE_URL` pointing at `:5430`, `BETTER_AUTH_URL=http://localhost:3000`, `BETTER_AUTH_SECRET`, plus `APIEXPRESS_API_KEY` for autofill)
3. `bun run db:push`
4. `bunx --bun @better-auth/cli migrate` (no npm script for this)
5. `bun run dev:seed` — prompts for name/email/phone/org, creates user + org + `owner` membership; exits silently if the email exists, aborts if the phone exists (both compared after normalization)

## Gotchas

- Dev port is **3000** (`strictPort: true` — fails if taken). `BETTER_AUTH_URL` must match the dev origin or auth cookies break. Dev serves HTTPS via `basicSsl`.
- No `db:generate` / `db:migrate` workflow — schema changes go via `db:push`. After changing auth config, regen with `gen:auth-schema` (with corrected config path) instead of editing `auth.gen.ts`.
- `drizzle.config.ts` has a `TODO: REPLACE WITH PULUMI INJECTION` note — env is still file-based, not injected.
- No CI workflows, no README — this file is the onboarding doc.
