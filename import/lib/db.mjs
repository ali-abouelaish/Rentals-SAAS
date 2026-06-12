// Database access for the import pipeline. Reads go through supabase-js with
// the service role key (no DB connection string exists in .env.local).
// Service role bypasses RLS, so every query/write is explicitly tenant-scoped.

import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — run with: node --env-file=.env.local import/run.mjs");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchAll(sb, table, tenantId, columns = "*") {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await sb.from(table).select(columns).eq("tenant_id", tenantId).order("id", { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

// Probe whether the import_ref migration has been applied.
async function hasImportRef(sb, table, tenantId) {
  const { error } = await sb.from(table).select("import_ref").eq("tenant_id", tenantId).limit(1);
  if (!error) return true;
  if (/import_ref/.test(error.message)) return false;
  throw new Error(`probe ${table}.import_ref: ${error.message}`);
}

export async function fetchSystemState(sb, tenantId) {
  const importRefReady = await hasImportRef(sb, "properties", tenantId);

  const [tenants, portfolios, properties, units, pmTenants, contracts, keys, bankDetails, unitPhotos] =
    await Promise.all([
      sb.from("tenants").select("id, name").eq("id", tenantId).then(({ data, error }) => {
        if (error) throw new Error(`fetch tenants: ${error.message}`);
        return data;
      }),
      fetchAll(sb, "portfolios", tenantId),
      fetchAll(sb, "properties", tenantId),
      fetchAll(sb, "units", tenantId),
      fetchAll(sb, "pm_tenants", tenantId),
      fetchAll(sb, "property_contracts", tenantId),
      fetchAll(sb, "keys", tenantId),
      fetchAll(sb, "portfolio_bank_details", tenantId),
      fetchAll(sb, "unit_photos", tenantId, "id, unit_id, property_id, url, category"),
    ]);

  if (!tenants.length) {
    throw new Error(`tenants row ${tenantId} does not exist — wrong tenant id?`);
  }

  return {
    tenantId,
    tenantName: tenants[0].name,
    importRefReady,
    portfolios, properties, units, pmTenants, contracts, keys, bankDetails, unitPhotos,
  };
}
