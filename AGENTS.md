<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Portal do Cliente — Operon

Next.js 16.2 App Router + Server Actions, Prisma 6 / PostgreSQL (Supabase),
Auth.js v5, Tailwind v4, TypeScript strict. UI copy and domain vocabulary are in
**Portuguese** — match the surrounding language when adding strings.

## How to apply the Next.js rule above

The bundled docs are ~2.6 MB across 423 files, and single pages run to 60 KB. The
breaking changes this codebase actually depends on are summarised in
`.cursor/rules/nextjs-16.mdc` — read that first. Only open
`node_modules/next/dist/docs/` when your task needs an API that summary doesn't
cover, and when you do: grep with `rg --no-ignore` (the tree is gitignored, so
ripgrep skips it by default) and read just the relevant section rather than the
whole file.

## Where things live

| Path | Contents |
|---|---|
| `src/app/` | Routes only — thin async server components that call `src/lib/data.ts` and render a component from `src/components/` |
| `src/components/` | All UI (60 files), plus shared primitives in `ui/` |
| `src/actions/` | `"use server"` entry points. Thin by design: guard → zod parse → service call → revalidate |
| `src/services/` | Business logic and zod schemas, plus `production/` and `invoicing/` subdomains. Invoicing uses an adapter registry (Moloni, Vendus, Sage, Primavera, InvoiceXpress) |
| `src/lib/data.ts` | Every cached read. Prisma → view model mapping |
| `src/lib/types.ts` | Hand-written `*VM` view-model interfaces returned by `data.ts` |
| `src/lib/cache-tags.ts` | `CACHE_TAGS` registry + `invalidateCache()`. All invalidation goes through here |
| `src/lib/` | Also: `prisma`, `auth-guard`, `errors`, `dates`, `generatePdf`, `import-schemas`, `storage`, `kpis`, `rate-limit`, `roles` |
| `src/auth.ts`, `auth.config.ts`, `proxy.ts` | Auth.js setup; `proxy.ts` is the route guard (Next 16 renamed `middleware`) |
| `prisma/schema.prisma` | Data model, source of truth (705 lines) |
| `tests/unit/`, `e2e/` | Vitest unit tests; Playwright end-to-end |
| `edge-gateway/` | Separate IoT gateway subproject (`.mjs`, own deps). Unrelated to the portal |

## Conventions

Server actions return `ActionResult` — expected domain failures come back as
`{ error: string }` rather than thrown, because Next.js redacts thrown Server Action
messages in production. Wrap action bodies in `guardAction()` from `src/lib/errors.ts`
and throw `AppError` subclasses (`UnauthorizedError`, `NotFoundError`,
`RateLimitedError`) from services. On the client, read the result with
`actionError()` from `src/lib/action-result.ts`.

Authorisation is per admin area via `requireAdminArea(...)` from `src/lib/auth-guard.ts`;
call it first in every admin action.

Reads belong in `src/lib/data.ts` behind `unstable_cache` with a tag from
`CACHE_TAGS`; writes belong in a service and must invalidate every tag they touch.
Over-invalidating is safe, under-invalidating shows stale data.

Nearly every page sets `export const dynamic = "force-dynamic"` (freshness is
handled by `unstable_cache` tags, not by static rendering); follow suit for new
pages. Most of `src/components/` is `"use client"`; shared primitives live in
`src/components/ui/`.

## Commands

`npm run dev` · `npm run lint` · `npm test` (vitest) · `npm run test:e2e` ·
`npm run db:migrate` · `npm run db:seed` · `npm run db:studio`
