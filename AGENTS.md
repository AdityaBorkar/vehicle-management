# AGENTS.md

## Commands

Runtime is Bun (`bun.lock`). Run scripts with `bun run <name>`:

```
bun run dev           # vite dev --host, port 3000 (strictPort)
bun run build         # vite build -> .output/
bun run check:lint    # biome check --fix (MUTATES files; read-only: bunx biome check .)
bun run check:types   # bun check --noEmit (verbatim from package.json, not tsc)
bun run test          # vitest run (focused: bunx vitest run <path>)
bun run db:push       # drizzle-kit push, no migration files
bun run db:studio     # drizzle-kit studio
bun run dev:seed      # bun scripts/seed.ts (name is dev:seed, not db:seed)
bun run gen:routes    # tsr generate (regen routeTree.gen.ts)
bun run gen:auth-schema # regen src/db-schema/auth.gen.ts after auth config changes
bun run workflow -- <name> --reg … # CLI for browser workflows (scripts/run-workflow.ts)
```

## Architecture

- **TanStack Start** file routing in `src/routes/`. `*.gen.ts` is gitignored (`src/routeTree.gen.ts`, `src/db-schema/auth.gen.ts`) — never hand-edit.
- **Nitro** via `nitro()` vite plugin; client env vars must use `PUBLIC_` prefix (`envPrefix` in `vite.config.ts`).
- **oRPC**: router at `src/rpc/router.ts` (namespaces `aadharCard`, `debug`, `document`, `driver`, `fastag`, `gpsDevice`, `license`, `reminder`, `vehicle`, `vehicleTransaction`, `workflow`). Procedures are named exports in `src/rpc/procedures/<kebab-case>.ts` (`document-history.ts`, `vehicle-ownership.ts` are helpers, not namespaces). All procedures use session middleware (`authorized`/`protectedProcedure` in `src/rpc/base.ts`) and scope rows by `userId`. Served at `/api/rpc` (`src/routes/api/rpc.$.ts`); isomorphic client is `src/lib/rpc.ts` (server calls router directly, browser uses `RPCLink`).
- **Auth** (Better Auth, `src/lib/auth-server.ts`): `drizzleAdapter` (pg, `auth` schema, plural) + `expo` / `phoneNumber` / `organization` / `tanstackStartCookies`. Signups hard-disabled (`databaseHooks.user.create.before` throws). `sendOTP` only `console.log`s; in `DEV` the login page offers "Dev login (autofill OTP)" reading it back via `getDevOtpCode` (`src/routes/api/-dev.ts`, refuses in production). Always `normalizePhoneNumber` (`src/lib/utils.ts`, E.164, India `+91` default) on write and login — Better Auth matches `phone_number` by exact string.
- **DB**: Drizzle + `node-postgres`; barrel `src/db-schema/index.ts`; instance `src/lib/db.ts` (empty-string fallback — fails at query time, not import). `schemaFilter: ["public", "auth", "debug"]`. The `debug` schema uses one shared `debugSchema` instance re-exported from the barrel — drizzle-kit's differ only registers schemas reachable via exports, so keep that export.
- **Vehicle RC lookup**: `vehicle.lookup` takes only a registration number (`/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/`, normalized via `formatVin`). Resolution: user's `vehicles` row → `external_api_calls` cache → live call. **Cashfree is the mandatory provider** (`src/lib/cashfree/server.ts`, server-only — never import from client components; `CASHFREE_CLIENT_ID`/`CASHFREE_CLIENT_SECRET`, retries 429/5xx only; APIExpress client kept but unused). Every call stores FULL request/response in `external_api_calls`; unmapped fields preserved in `rc_raw`. `vehicle.syncRc({vehicleId})` rewrites all mapped columns + `rc_raw` + `rcFetchedAt`.
- **Storage** (`src/browser-automation/artifact-store.ts`): S3 via RustFS when `RUSTFS_ENDPOINT` set, else local `ARTIFACT_DIR`/`.local/artifacts`. Buckets `artifacts` (workflow PDFs, debug media) and `documents` (`uploads/documents/...`). DB rows store only the stable `relativePath`. Auth-checked routes: `GET /api/pucc/:runId`, `GET /api/debug-artifact/:runId` (`?kind=video|console|artifact|screenshot|llm-image&stepId=`, range-supported video), `GET /api/documents/:documentId`, `POST /api/documents/upload` (multipart, PDF/JPEG/PNG ≤10MB). One-shot local→RustFS migration: `bun scripts/migrate-artifacts-to-rustfs.ts [--dry-run]`.
- **Workflows engine** (`engine.ts` + `workflow-run.ts` + `workflow.ts` namespace): `enqueueWorkflowRun` inserts `queued` and pumps in-process (concurrency 1 — portals block multiple tabs); restart leaves `running` rows stuck, call `requeueStaleRunning()`. Poll via `workflow.getRun`/`listRuns`; `getLatestSucceededRun` (as `workflow.getLatestPucc`) is the "stored certificate". CLI defaults to queued mode (writes observability rows); `--direct` skips queue/DB, `--mock-captcha` avoids AI spend. Needs `DATABASE_URL` + user (`--user-id` / `WORKFLOW_USER_ID` / first user in DB).
- **Debug observability** (`observability.ts` + `captcha-ledger.ts`, `debug` namespace, `/workflows` + `/runs/$runId`): every run mirrors into `debug.workflows`, per-action trail into `debug.browser_automation_steps` (retries as `warn`, terminal failure as `error` + screenshot), console/pageerrors into `debug.logs`, every CAPTCHA into `debug.llm_requests` (redacted params, image in storage — never secrets). Video via persistent-context `recordVideo` (`BROWSER_VIDEO_DIR`/`.local/videos/`), falls back to screenshots-only.
- **CAPTCHA** (`captcha.ts`): Meta AI vision, OpenAI-compatible `/chat/completions` (`META_AI_API_KEY`/`BASE_URL`/`MODEL` default `muse-spark-1.3-contributor`). Reasoning model — keep `max_tokens` high (e.g. 1024) or content truncates to null.
- **PUCC** (`workflows/pucc.ts`, `pucc-fetch`): PUC portal `#regnNumber` / `#chessiNo` / `#imgCaptchaId` / `#showDetails`, retries CAPTCHA, saves print view (popup when one opens, else current page) as PDF via CDP `Page.printToPDF`. UI: `use-pucc-certificate.ts` + `PuccCertificateButton`/`PuccCertificateMenuItem`, chassis-last-5 derived from VIN (`src/lib/pucc.ts`).
- **Transaction history** (`workflows/vahan-transaction-history.ts` → `vehicle_transactions` → `vehicleTransaction` namespace): replaces the per-vehicle snapshot; vehicle page has Overview/Transaction History tabs, Refresh enqueues + polls. Live-portal quirk: ONE shared entry box across modes — the checked mode radio is authoritative, type into the single visible non-CAPTCHA box. Radio clicks go label-first, then box + explicit `change` kick (native + jQuery).
- **Manual documents** (`goods_permit`, `speed_governor` — no expiry; `purchase_order`, `form20` — optional; rules in `src/lib/manual-documents.ts`): valid-from + vehicle + file required for all four; expiry prohibited for no-expiry kinds. Upload first, then `document.create` with the key. Renew preserves history; no-expiry kinds never appear in overdue lists.
- **Styling**: Tailwind v4 + Shadcn (`base-nova`, `zinc`, `tabler` per `components.json`). Real stylesheet is `src/routes/styles.css` (wired via `?url` in `__root.tsx`); `components.json`'s `css: src/styles.css` is stale, that file does not exist.
- **Stubs/empty**: `infra/index.ts` is empty. `scrapeChallanDetails` still returns `null` (`scrapeVehicleDetails` works via `vahan-vehicle-details`). Browser uses `patchright` + persistent Chrome profile (`BROWSER_PROFILE_DIR` or `~/.cache/vehicle-management/chrome-profile`), headed by default — `HEADLESS=1` for headless; locale `en-IN`, timezone `Asia/Kolkata`. PostHog provider is commented out in `__root.tsx` — app runs without PostHog keys.

## Conventions

- Path alias `#/*` → `./src/*` only (`tsconfig.json` + vite `tsconfigPaths`).
- Biome defaults: tabs, double quotes; import organization is automatic. `useComponentExportOnlyModules` is off for `src/routes/**` and `src/components/**` (route modules export `Route` plus components).
- Strict TS: `noUnusedLocals` / `noUnusedParameters` fail the check; `noUncheckedIndexedAccess` (bracket access is `T | undefined`); `exactOptionalPropertyTypes`; `verbatimModuleSyntax` (use `import type`).
- `AppShell` (`__root.tsx`) renders the sidebar only when a session exists.

## Setup

1. `docker compose up -d` — postgres:18-alpine (host **5430**→5432, `postgres`/`postgres`/`mydb`, data in `.local/postgres/`) + RustFS (API `:9000`, console `:9001`, data in `.local/rustfs/`, dev defaults `rustfsadmin`/`rustfsadmin`)
2. Populate `.env.local` (see `.env.example`: `DATABASE_URL` → `:5430`, `BETTER_AUTH_URL=https://localhost:3000` (HTTPS — dev serves via `basicSsl`), `BETTER_AUTH_SECRET`, `CASHFREE_*` for autofill; `RUSTFS_*` optional — unset falls back to `.local/artifacts`)
3. `bun run db:push`
4. `bunx --bun @better-auth/cli migrate` (no npm script for this)
5. `bun run dev:seed` — prompts for name/email/phone/org, creates user + org + `owner` membership; exits silently if email exists, aborts if phone exists

## Gotchas

- Dev port **3000** (`strictPort: true` — fails if taken). `BETTER_AUTH_URL` must match the dev origin or auth cookies break. Dev serves HTTPS via `basicSsl`.
- No `db:generate`/`db:migrate` — schema changes go via `db:push`. Never edit `auth.gen.ts` by hand; regen with `gen:auth-schema`.
- `src/env.ts` (T3 env) validation never runs at startup — its only importers (`src/components/provider.tsx`, `src/posthog/provider.tsx`) are both unmounted (`__root.tsx` has the provider commented out). `drizzle.config.ts` and `scripts/seed.ts` load dotenv from `.env.local` then `.env` independently.
- No CI workflows, no README — this file is the onboarding doc.
