import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of raw.split("\n")) { const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const { data: tenants } = await sb.from("pm_tenants").select("id, full_name, tenant_id");
const { data: contracts } = await sb.from("property_contracts").select("id, pm_tenant_id, status");

const isPlaceholder = (n)=> (n||"").toLowerCase().includes("placeholder");
const ph = tenants.filter(t=>isPlaceholder(t.full_name));
console.log("Total pm_tenants:", tenants.length);
console.log("Placeholder pm_tenants (to delete):", ph.length);

// which placeholder tenants still have contracts (would block delete via restrict)
const contractsByTenant = new Map();
for (const c of contracts){ if(!contractsByTenant.has(c.pm_tenant_id)) contractsByTenant.set(c.pm_tenant_id,[]); contractsByTenant.get(c.pm_tenant_id).push(c); }
const phWithContract = ph.filter(t=>contractsByTenant.has(t.id));
console.log("  ...of those, still referenced by a contract:", phWithContract.length);

const real = tenants.filter(t=>!isPlaceholder(t.full_name));
console.log("\nNon-placeholder pm_tenants:", real.length);

// contract status distribution
const statusCount = {};
for (const c of contracts) statusCount[c.status]=(statusCount[c.status]||0)+1;
console.log("All contracts by status:", statusCount);

const ACTIVE = new Set(["active"]);
const noContract = real.filter(t=>!contractsByTenant.has(t.id));
const noActive = real.filter(t=> contractsByTenant.has(t.id) && !contractsByTenant.get(t.id).some(c=>c.status==="active"));
console.log("\nReal tenants with NO contract at all:", noContract.length);
for (const t of noContract) console.log("   ", t.id, JSON.stringify(t.full_name));
console.log("Real tenants that HAVE contract(s) but none 'active':", noActive.length);
for (const t of noActive) console.log("   ", t.id, JSON.stringify(t.full_name), "statuses=", contractsByTenant.get(t.id).map(c=>c.status));
