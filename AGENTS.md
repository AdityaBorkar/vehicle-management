# AGENTS.md

## Commands

All scripts use `bun --bun` (not Node):

```
bun --bun run dev          # dev server on :3010 (strictPort)
bun --bun run build        # production build
bun --bun run test         # vitest run (no tests exist yet)
bun --bun run check:lint   # biome check --fix (lint + format)
bun --bun run check:types  # tsc --noEmit (strict mode)
bun --bun run db:push      # push schema directly (no migration files)
bun --bun run db:seed      # interactive admin seeder (prompts for name/email/phone/org)
bun --bun run db:studio    # drizzle studio UI
```

Verification order: **check:lint → check:types → test**

## Architecture

- **TanStack Start** (SSR React) + file-based routing via TanStack Router
- **Nitro** server (`nitro-nightly` aliased as `nitro` in package.json); Sentry packages externalized in vite config
- **oRPC** API layer — router at `src/rpc/router.ts`, procedures in `src/rpc/procedures/` (`dieselCard`, `fastag`, `gpsDevice`, `license`, `reminder`, `vehicle`), auth middleware at `src/rpc/base.ts` (`authorized` procedure requires session), catch-all route at `src/routes/api/rpc.$.ts` (prefix: `/api/rpc`), client at `src/lib/orpc-client.ts`, TanStack Query utils at `src/lib/orpc-query.ts`
- Routes: `src/routes/` — add a file, route auto-registers
- `src/routeTree.gen.ts` — **never edit**, auto-generated
- DB: PostgreSQL via Drizzle ORM; schema in `src/db-schema/` (barrel export at `index.ts`), instance in `src/lib/db/server.ts`
- Auth: Better Auth with `tanstackStartCookies`, `phoneNumber`, and `organization` plugins; **signups are disabled** (throws before user creation); server config `src/lib/auth/server.ts`, catch-all route `src/routes/api/auth.$.ts`, client `src/lib/auth/client.ts`
- PostHog: `integrations/posthog/provider.tsx` — **optional**, disabled when `PUBLIC_POSTHOG_KEY` is unset
- Forms: custom form system at `integrations/forms/` (Field, FieldArray, ComboboxField, Form components with react-hook-form)
- Browser automation: `browser-automation/index.ts` — Puppeteer-based scraper (challans, vehicle details); headless=false, needs display
- Env validation: T3Env at `src/env.ts` — only validates `SERVER_URL` and `PUBLIC_APP_TITLE`; `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` are consumed directly by their packages

## Route Structure

- `src/routes/__root.tsx` — AppShell: sidebar nav for authenticated users, unauthenticated children render without shell
- `src/routes/(app)/route.tsx` — auth guard: **redirects unauthenticated users to `/`**, wraps child routes in centered card layout
- App routes under `(app)/`: `dashboard.tsx`, `calendar.tsx`, `vehicles/`, `drivers/`, `settings/` (`user.tsx`, `whatsapp.tsx`, `connections.tsx`), `(debug)/workflows.tsx`

## Style Conventions

- **Biome** with **spaces** (indentWidth 2) and **double quotes** — no Prettier, no eslint
- Biome auto-organizes imports on format; sorted classes enforced (`useSortedClasses`)
- Shadcn components (`src/components/ui/`) and data-table-filter: linter mostly off (`recommended: false`)
- Route files: `useComponentExportOnlyModules` disabled
- Tailwind CSS v4 + Shadcn (**base-nova** style, **zinc** base, **tabler** icons)
- `src/routes/styles.css` and `src/routeTree.gen.ts` excluded from Biome
- `verbatimModuleSyntax` — use `import type` for type-only imports or tsc errors
- `noUnusedLocals` / `noUnusedParameters` — unused vars/params fail typecheck
- `noPropertyAccessFromIndexSignature` — use bracket notation: `process.env["KEY"]` (not `process.env.KEY`)
- `noUncheckedIndexedAccess` — array/object bracket access returns `T | undefined`, requires null checks
- `exactOptionalPropertyTypes` — optional props can't accept `undefined` explicitly without union type

## Setup

1. `docker compose up -d` — postgres:18-alpine on :5432, user/pass/db = `postgres`/`postgres`/`mydb`
2. Populate `.env.local` (see Environment Variables below)
3. `bun --bun run db:push`
4. `bunx --bun @better-auth/cli migrate`
5. `bun --bun run db:seed` — creates admin user + organization

## Environment Variables (`.env.local`)

- `DATABASE_URL` — e.g. `postgresql://postgres:postgres@localhost:5432/mydb`
- `BETTER_AUTH_URL` — **must match dev server port**: `http://localhost:3010`
- `BETTER_AUTH_SECRET` — generate: `bunx --bun @better-auth/cli secret`
- `PUBLIC_POSTHOG_KEY` — optional, app works without it
- `PUBLIC_POSTHOG_HOST` — optional, defaults to `https://us.i.posthog.com`

## Gotchas

- Dev server port **3010** with `strictPort: true` — fails if port is taken
- `BETTER_AUTH_URL` must use port 3010 (not 3000) — mismatch breaks auth cookies
- No `db:generate` / `db:migrate` — only `db:push` (direct schema push, no migration files)
- Shadcn components installed via `pnpm dlx shadcn@latest add <component>` (pnpm CLI, not bun)
- Drizzle config loads env via `dotenv` from `.env.local` and `.env`
- `@/*` resolves to `./src/*`; `#/*` resolves to `./integrations/*` (tsconfig paths)
- `process.env` keys must use bracket notation (`process.env["KEY"]`) due to `noPropertyAccessFromIndexSignature`
- Auth signups are disabled — new users must be created via `db:seed` or direct DB insert
