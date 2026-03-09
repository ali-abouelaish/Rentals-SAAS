-- Run this in Supabase Dashboard > SQL Editor so non-admin users can save landlord changes.
-- (RLS was previously restricting updates to admins only.)

DROP POLICY IF EXISTS "landlords update" ON landlords;

CREATE POLICY "landlords update"
ON landlords FOR UPDATE
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());
