-- Phase 5: Agency Module Configuration
-- Controls which products (Rental Agency / Property Management) each agency can access.
-- Super admin assigns modules per tenant with a publish/draft workflow.
-- Agencies only see changes after the super admin explicitly publishes.

CREATE TABLE IF NOT EXISTS public.agency_module_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Draft state (what super admin is configuring, not yet live)
  rental_agency_enabled boolean NOT NULL DEFAULT true,
  property_management_enabled boolean NOT NULL DEFAULT false,

  -- Live/published state (what the agency actually sees)
  live_rental_agency_enabled boolean NOT NULL DEFAULT true,
  live_property_management_enabled boolean NOT NULL DEFAULT false,

  -- Publishing metadata
  -- published = false means draft differs from live (unpublished changes exist)
  -- published = true means draft matches live (nothing pending)
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  published_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  last_updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  UNIQUE (tenant_id)
);

ALTER TABLE public.agency_module_configs ENABLE ROW LEVEL SECURITY;

-- Users can read their own tenant's config (for app-side sidebar/dashboard rendering).
-- Writes are service-role only (super admin panel via createSupabaseAdminClient).
CREATE POLICY "agency_module_configs_tenant_read"
  ON public.agency_module_configs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_agency_module_configs_tenant
  ON public.agency_module_configs (tenant_id);
