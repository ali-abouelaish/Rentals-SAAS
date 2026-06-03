# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run Next.js linter
npm run create:superuser  # Create initial admin user (requires .env.local)
```

No test framework is configured.

## Architecture

**Next.js 14 App Router** multi-tenant SaaS for rental agencies. TypeScript strict mode, Supabase (PostgreSQL + Auth), Tailwind CSS, React Hook Form + Zod.

### Routing

- `src/app/(auth)/` — Public auth pages (login, signup, invite, reset)
- `src/app/(app)/` — Protected app pages (dashboard, clients, rentals, invoices, agents, bonuses, earnings, admin)
- `src/app/api/` — API routes
- `middleware.ts` — Extracts tenant from subdomain (`{slug}.harborops.co.uk`) and sets `x-tenant` header; enforces auth on all non-public paths

### Multi-Tenancy

All DB queries must be scoped to `tenant_id`. Tenant is extracted from the subdomain in middleware and passed via the `x-tenant` header. Row-Level Security (RLS) is enforced at the DB level. Never bypass RLS except with `createAdminClient()` (uses service role key).

### Feature Structure

Features live in `src/features/<name>/` and follow this pattern:

```
/actions      # Server actions ("use server") — mutations
/data         # Data fetching functions (server-side)
/domain       # TypeScript types + Zod schemas
/ui           # React components
/pdf          # PDF generation (optional, uses @react-pdf/renderer)
```

### Data Layer

- **Supabase client** — Direct `supabase.from().select()` queries (no ORM)
- **Server actions** — All mutations use Next.js server actions (`"use server"`)
- **RPC functions** — Complex operations via `supabase.rpc()`: `next_rental_code`, `peek_rental_code`, `earnings_breakdown`, `bonus_code_check`
- **Supabase clients** — `src/lib/supabase/`: `server.ts` (SSR), `client.ts` (browser), `admin.ts` (service role), `middleware.ts`

### Auth

Supabase Auth with SSR cookie management. Role-based access via `src/lib/auth/requireRole.ts`. Use `requireRole()` at the top of server actions and data fetchers to enforce permissions.

### Database

Migrations in `supabase/migrations/` (timestamped SQL files). Schema defined in `supabase/schema.sql`, RLS policies in `supabase/rls.sql`.

Core tables: `tenants`, `user_profiles`, `agent_profiles`, `clients`, `landlords`, `rental_codes`, `bonuses`, `invoices`, `email_outbox`, `tenant_feature_entitlements`.

### Email

Resend (SMTP via nodemailer) is the only delivery path. Async delivery tracked via `email_outbox` table; the worker drains it through `sendAgencyEmail`. Email utilities in `src/lib/email/`.

### Feature Flags

Per-tenant feature entitlements via `tenant_feature_entitlements` table. Entitlement checks in `src/lib/entitlements/`.

## Environment Variables

Required in `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin key |
| `NEXT_PUBLIC_APP_URL` | App base URL |
| `RESEND_API_KEY` | Email delivery |
| `OPENAI_API_KEY` | AI features |
| `EMAIL_FROM_DOMAIN` | Domain used in the From address (`noreply@<domain>`) |
| `EMAIL_WORKER_SECRET` | Email worker auth |
| `SCRAPER_API_KEY` | Landlord scraper |
| `APP_PORTAL_DOMAIN` | Portal domain for links |
| `MYDEPOSITS_ENV` | mydeposits environment (`sandbox` \| `production`) |
| `MYDEPOSITS_CLIENT_ID` | mydeposits OAuth client id |
| `MYDEPOSITS_CLIENT_SECRET` | mydeposits OAuth client secret |
| `MYDEPOSITS_REDIRECT_URI` | OAuth callback URL (`https://<host>/api/mydeposits/callback`) |
| `MYDEPOSITS_TOKEN_SECRET` | 32-byte hex key encrypting mydeposits tokens (`openssl rand -hex 32`) |
| `CRON_SECRET` | Bearer secret for `/api/cron/*` (shared; also used by `mydeposits-poll`) |

For `create:superuser`: also set `DEV_SUPERUSER_EMAIL`, `DEV_SUPERUSER_PASSWORD`, and optionally `DEV_TENANT_NAME`.

## UI Rules

- Every input field must have a visible `<label>` element positioned above it (not placeholder-only).
- Every delete button must be red and use the `Trash2` icon from `lucide-react`.
- Every action button (e.g. save, submit, confirm) must use the tenant's secondary button variant.

## Feature Entitlement Rules

- Any feature added to the sidebar must be gated by a corresponding row in the `tenant_feature_entitlements` table. The sidebar item must only render if the tenant has that entitlement. Use the existing entitlement check utilities in `src/lib/entitlements/`. A migration must also be added to insert the entitlement row for any tenant that should have access.
- Every new feature must also be added to the super admin features management view, so super admins can toggle it per tenant.

## Database Rules

- Any schema change must be made via a new timestamped migration file in `supabase/migrations/` — never modify the database directly or edit existing migrations.

## Supabase & RLS Rules

- Always wrap `auth.uid()` in `(select auth.uid())` in RLS policies for performance.
- Every new table must have RLS enabled and policies defined — never skip.
- Never use the service role key client-side — admin client (`createSupabaseAdminClient()`) is server-only.
- Never hardcode Supabase URLs or keys — always use env vars.
- Set Supabase MCP to **read-only** — Claude generates SQL, you apply it manually. Never point MCP at production.

## Component & Data Rules

- Use Server Components by default; add `"use client"` only when necessary (interactivity, browser APIs, hooks).
- All mutations use Server Actions (`"use server"`).
- Use Supabase SSR client (`createSupabaseServerClient`) in server context; browser client (`createSupabaseBrowserClient`) in `"use client"` components.
- Handle loading, error, and empty states on every data fetch.

## Key Dependencies

- `@radix-ui/*` — Accessible UI primitives
- `framer-motion` — Animations
- `react-hook-form` + `zod` — Forms & validation
- `@react-pdf/renderer` — PDF generation
- `recharts` — Charts
- `sonner` — Toast notifications
- `lucide-react` — Icons
- `class-variance-authority` — Component variant styling
