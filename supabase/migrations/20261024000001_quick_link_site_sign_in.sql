-- Website sign-in for Useful Resources links (dashboard pinned sites).
--
-- When sso_enabled, the dashboard card opens /api/quick-links/<id>/launch,
-- which form-posts a 60-second signed token to sso_callback_url so the
-- agency's website can sign the staff member in without a login page.
--
-- No secret is stored. The per-link signing secret is derived server-side
-- from QUICK_LINK_SSO_SECRET + id + sso_key_id, so every agency user can keep
-- reading these rows (the existing SELECT policy — the dashboard needs it)
-- without seeing anything that signs tokens. Replacing a site's secret means
-- writing a new sso_key_id; writes stay admin-only under the existing policy.

ALTER TABLE tenant_quick_links
  ADD COLUMN IF NOT EXISTS sso_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sso_callback_url text,
  ADD COLUMN IF NOT EXISTS sso_key_id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE tenant_quick_links
  ADD CONSTRAINT tenant_quick_links_sso_callback_check
  CHECK (NOT sso_enabled OR sso_callback_url ~* '^https?://');
