<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Portal do Cliente — Operon

Next.js 16.2 App Router + Server Actions, Prisma 6 / PostgreSQL (Supabase),
Auth.js v5, Tailwind v4, TypeScript strict. UI copy and domain vocabulary are in
**Portuguese** — match the surrounding language when adding strings.

## What this app is

**Operon** is a manufacturing operations platform for an industrial SME in
Portugal: a shop-floor MES joined to a customer-facing portal, so an order is
tracked from quote to invoice against what the machines actually produced. The
repo name predates the MES half — the client portal is now one module of four
(`src/lib/branding.ts` is the source of truth for the product/module names).

| Module | Surface | Audience |
|---|---|---|
| Operon Core | `/admin` | Factory staff — production, warehouse, sales, quality |
| Operon Station | `/producao/terminal` | Shop-floor operators, PIN login on a shared tablet (not portal session users) |
| Operon Portal | `/dashboard` | The factory's client companies |
| Operon Link | `edge-gateway/` → `/api/machine/ingest` | Machines — PLCs, CNCs, sensors |

The spine of the domain: **orçamento** (quote, costed from material weight plus
operation rates) → client accepts → **encomenda** (`Order`) → one `WorkOrder` per
order line → one `WorkOrderStep` per workstation in the product's routing
(**roteiro**) → operators run steps at the terminal while Link counts real
output → quality and **não conformidades** → shipped → `Invoice`, issued through
an external provider adapter.

Nav vocabulary: Encomendas = `Order`, Orçamentos = `Quote`, Requerimentos =
`Request` (a client-raised message thread — quote/complaint/info), Produção =
work orders, planning and OEE, Armazém = materials, batches and traceability,
Trabalhadores = `Operator`, Desempenho = KPIs.

### Domain invariants

- **Clients never see the factory floor.** No machine, operator or internal
  station name may reach `/dashboard` — the portal shows only
  `Workstation.clientStageLabel`, collapsed by `buildClientStages()`. Adding a
  field to a client-facing VM is a disclosure decision, not a formatting one.
- **For quantities, the machine is the source of truth.** What the operator
  declared is kept next to the machine count and the divergence is surfaced
  (`computeDiscrepancy`), never silently reconciled — that anti-tampering
  guarantee is the whole point of Link.
- **History is snapshotted, not joined.** `OrderItem`, `WorkOrder` and
  `QuoteLineOperation` freeze reference, name and price at write time, so a sent
  quote or a past order never drifts when the catalogue or a rate changes. Keep
  that property when adding fields.
- **One deployment per factory.** The tenant is configuration, not data: factory
  identity comes from `NEXT_PUBLIC_TENANT_*` and the invoicing backend from
  `INVOICE_PROVIDER`. Never hardcode a factory's name, address or provider.

`README.md` covers only the original client portal (orders and requests) and
predates production, quotes, warehouse and invoicing — prefer this file.

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
| `edge-gateway/` | Operon Link — separate IoT gateway subproject (`.mjs`, own deps and tests, own `README.md`). MQTT stays inside the factory; the gateway forwards to `/api/machine/ingest` over HTTPS |

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

Commercial reads (`orders`, `quotes`, `requests`) use the same tag cache as
production. Exceptions that stay uncached are **now-relative** projections
(`getProductionSchedule`, `getMaintenancePlans`) and ad-hoc search
(`findBatchTrace`). Readers must list every model family they join — e.g.
`getWorkOrders` tags both `workOrders` and `materials` because shortfalls
read `stockQty`.

Pure helpers live next to their IO services but without a `.service` suffix:
`production-status.ts`, `order-status.ts`, `maintenance.ts` (date/urgency) vs
`production/*.service.ts` and `production/maintenance.service.ts`. Do not
import Prisma from the pure modules.

Public self-registration is **closed**. New portal users are created by
`inviteUser` (factory admin or company admin). `/registo` explains the
invite flow.

`landing/` is a static marketing site (HTML/CSS), deployed as a separate
Vercel project from the same repo. It is not part of the Next.js app.

CI (`.github/workflows/tests.yml`) runs on every branch. Factory Vercel
projects do not auto-deploy on git push (`git.deploymentEnabled: false` in
the root `vercel.json`); after tests pass, the workflow POSTs Deploy Hooks
for `main` / `staging`. Landing is unchanged and still deploys from git.

### Money: planned `Float` → `Decimal`

Every `*Eur` / cost field is currently PostgreSQL `DOUBLE PRECISION`
(`Float` in Prisma). Sums of unit prices for quotes and invoices can
accumulate binary rounding error. The intended follow-up is a dedicated
migration to `Decimal(12, 2)` starting with `Quote*`, `Invoice.totalEur`
and `OrderItem.unitPriceEur`, then the remaining catalogue/stock cost
fields. Do not mix `Float` and `Decimal` in the same arithmetic path
once that starts.

Nearly every page sets `export const dynamic = "force-dynamic"` (freshness is
handled by `unstable_cache` tags, not by static rendering); follow suit for new
pages. Most of `src/components/` is `"use client"`; shared primitives live in
`src/components/ui/`.

## Commands

`npm run dev` · `npm run lint` · `npm test` (vitest) · `npm run test:e2e` ·
`npm run db:migrate` · `npm run db:seed` · `npm run db:studio`
