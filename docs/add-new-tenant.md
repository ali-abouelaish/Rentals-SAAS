# Adding a New Tenant

A "tenant" here means a **rental agency** (the multi-tenant unit) — not a `pm_tenant` (a renter). Tenant creation is **super-admin only**; there is no self-serve signup.

This doc has two parts:
- [Runbook](#runbook) — clickable steps for a super admin
- [Technical reference](#technical-reference) — what each step writes to the database

---

## Runbook

### 1. Create the tenant (required)

1. Sign in as a super admin and go to **Admin → Tenants**.
2. Click **New Tenant**.
3. Enter:
   - **Name** — the agency's display name.
   - **Slug** — used as the subdomain (`{slug}.harborops.co.uk`). Auto-normalized to lowercase and hyphenated. Must be unique.
4. Click **Create**.

The tenant row is created with `status = active`, and the action is written to the activity log.

> **DNS:** No DNS work is required. Wildcard `*.{APP_PORTAL_DOMAIN}` is already pointed at the app server, and middleware resolves the slug from the host automatically.

### 2. Enable features (required)

New tenants start with **zero feature entitlements**. Until you enable at least one, the sidebar will be empty for users in that tenant.

1. From **Admin → Tenants**, click the new tenant.
2. Open the **Features** tab.
3. Toggle on each feature the tenant should see.

### 3. Publish module configuration (required)

Modules decide whether the tenant sees the rental-agency product, property-management product, or both.

1. On the tenant detail page, open the **Modules** tab.
2. Save a draft configuration.
3. Click **Publish** to promote the draft to the live config.

Until a module config is published, the tenant has no live module assignment.

### 4. Invite the first agency admin (required)

1. On the tenant detail page, open the **Users** tab.
2. Click **Invite User** and enter the admin's email and role.
3. The system sends an invite email with a tenant-scoped link: `https://{slug}.harborops.co.uk/invite/accept`.
4. The invitee accepts, sets a password, and is attached to the tenant on first sign-in.

### 5. Set branding (optional)

1. On the tenant detail page, open the **Branding** tab.
2. Upload the logo, set primary/secondary colors, and configure the secondary button variant.
3. Save — this upserts a row in `tenant_branding_settings`.

If skipped, the tenant uses platform defaults.

### 6. Set billing info (optional)

1. On the tenant detail page, open the **Billing** tab.
2. Choose a plan (default: `starter`) and fill in billing details.
3. Save — this upserts a row in the tenant billing info table.

Only required if the billing module is enabled for this tenant.

---

## Technical reference

| Step | What runs | Tables written |
|---|---|---|
| 1. Create tenant | [`createTenantAction()`](../src/features/admin/actions/admin.ts#L52-L83) (called from [`CreateTenantDialog.tsx`](../src/features/admin/ui/CreateTenantDialog.tsx)) | `tenants` (insert: name, slug, `status='active'`), `activity_log` (audit row) |
| Subdomain routing | [`middleware.ts:26-51`](../src/middleware.ts#L26-L51) extracts the slug from the host on every request and sets the `x-tenant` header | none (read-only) |
| 2. Enable features | [`setTenantFeatureEnabledAction()`](../src/features/admin/actions/admin.ts#L526-L557) per feature toggle | `tenant_feature_entitlements` (upsert) |
| 3. Publish modules | [`saveModuleConfigDraftAction()`](../src/features/admin/actions/admin.ts#L567-L578) → [`publishModuleConfigAction()`](../src/features/admin/actions/admin.ts#L585-L626) | `agency_module_configs` (draft, then promote to live) |
| 4. Invite admin | Super-admin invite flow at [`admin.ts:443-524`](../src/features/admin/actions/admin.ts#L443-L524); on first sign-in [`ensureTenantSetup()`](../src/features/tenants/actions/tenants.ts#L6-L50) attaches the user | `auth.users` (Supabase Auth invite), `user_profiles` (on accept) |
| 5. Branding (optional) | `saveTenantBrandingAction()` in [`admin.ts`](../src/features/admin/actions/admin.ts) | `tenant_branding_settings` (upsert) |
| 6. Billing (optional) | Billing form action | tenant billing info table (upsert; default `plan='starter'`, `status='active'`) |

### What is *not* automatic on tenant creation

- No default rows in `tenant_feature_entitlements` — must be set in step 2.
- No default `agency_module_configs` row — must be published in step 3.
- No `tenant_branding_settings` row — created on first save (step 5).
- No billing row — created on first save (step 6).
- No users — must be invited (step 4). The dev-only [`ensureTenantSetup()`](../src/features/tenants/actions/tenants.ts#L6-L50) bootstrap is for local development, not production.

### RLS and tenant scoping

Every query downstream of tenant creation is scoped via RLS by `tenant_id`. The `x-tenant` header set by middleware is the source of truth for which tenant a request belongs to. Never bypass RLS except via [`createSupabaseAdminClient()`](../src/lib/supabase/admin.ts) (server-only, service role).

### Required env vars

For tenant creation to function end-to-end:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `APP_PORTAL_DOMAIN` — base domain for subdomain routing (e.g., `harborops.co.uk`)
- `NEXT_PUBLIC_APP_URL` — used in invite emails
- `RESEND_API_KEY` (or AWS SES vars) — to send the invite email in step 4
