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
bun --bun run db:studio    # drizzle studio UI
```

Verification order: **check:lint → check:types → test**

## Architecture

- **TanStack Start** (SSR React) + file-based routing via TanStack Router
- **Nitro** server (`nitro-nightly` aliased as `nitro` in package.json); Sentry packages externalized in vite config
- Routes: `src/routes/` — add a file, route auto-registers
- `src/routeTree.gen.ts` — **never edit**, auto-generated
- DB: PostgreSQL via Drizzle ORM; schema in `src/db/schema.ts`, instance in `src/db/index.ts`
- Auth: Better Auth (email/password) with `tanstackStartCookies` plugin; server config `src/lib/auth.ts`, catch-all route `src/routes/api/auth/$.ts`, client `src/lib/auth-client.ts`, session hook `src/integrations/better-auth/header-user.tsx`
- PostHog: `src/integrations/posthog/provider.tsx` — **optional**, disabled when `VITE_POSTHOG_KEY` is unset
- Env validation: T3Env at `src/env.ts` — only validates `SERVER_URL` and `VITE_APP_TITLE`; `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` are consumed directly by their packages

## Style Conventions

- **Biome** with **tabs** and **double quotes** — no Prettier, no eslint
- Biome auto-organizes imports on format
- Tailwind CSS v4 + Shadcn (new-york, zinc base, lucide icons)
- `src/styles.css` and `src/routeTree.gen.ts` excluded from Biome
- `verbatimModuleSyntax` — use `import type` for type-only imports or tsc errors
- `noUnusedLocals` / `noUnusedParameters` — unused vars/params fail typecheck

## Setup

1. `docker compose up -d` — postgres:18-alpine on :5432, user/pass/db = `postgres`/`postgres`/`mydb`
2. Populate `.env.local` (see Environment Variables below)
3. `bun --bun run db:push`
4. `bunx --bun @better-auth/cli migrate`

## Environment Variables (`.env.local`)

- `DATABASE_URL` — e.g. `postgresql://postgres:postgres@localhost:5432/mydb`
- `BETTER_AUTH_URL` — **must match dev server port**: `http://localhost:3010`
- `BETTER_AUTH_SECRET` — generate: `bunx --bun @better-auth/cli secret`
- `VITE_POSTHOG_KEY` — optional, app works without it
- `VITE_POSTHOG_HOST` — optional, defaults to `https://us.i.posthog.com`

## Gotchas

- Dev server port **3010** with `strictPort: true` — fails if port is taken
- `BETTER_AUTH_URL` must use port 3010 (not 3000) — mismatch breaks auth cookies
- No `db:generate` / `db:migrate` — only `db:push` (direct schema push, no migration files)
- Shadcn components installed via `pnpm dlx shadcn@latest add <component>` (pnpm CLI, not bun)
- Drizzle config loads env via `dotenv` from `.env.local` and `.env`
- Root `.env.ts` is empty (0 bytes) — not the same as `src/env.ts`
- `@/*` resolves to `./src/*` (tsconfig paths); Shadcn UI alias: `@/components/ui`
