CREATE TABLE tenant_quick_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       text NOT NULL,
  url         text NOT NULL,
  description text,
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX ON tenant_quick_links (tenant_id, position);

ALTER TABLE tenant_quick_links ENABLE ROW LEVEL SECURITY;

-- Any authenticated tenant user can view their tenant's links
CREATE POLICY "tenant users can view quick links"
  ON tenant_quick_links FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

-- Only admins (tenant admin or super_admin) can insert/update/delete
CREATE POLICY "admins can manage quick links"
  ON tenant_quick_links FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
