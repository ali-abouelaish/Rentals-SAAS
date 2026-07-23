// Start (create) active contracts for AP Real Estate tenants who have none.
// Maps tenant -> unit via units.pm_tenant_id. Rent = unit.min_price_pcm
// (fallback max/couples), deposit = unit.deposit. Start date 2026-07-01.
// No PDF/document_url. DRY-RUN by default; pass --apply to write.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of raw.split("\n")) { const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const APPLY = process.argv.includes("--apply");
const START_DATE = "2026-07-01";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

console.log(`\n=== start-contracts [${APPLY?"APPLY":"DRY-RUN"}] start_date=${START_DATE} ===\n`);

const { data: agencies } = await sb.from("tenants").select("id, name");
const ap = agencies.find(a=>a.name==="AP Real Estate");

const { data: tenants } = await sb.from("pm_tenants").select("id, full_name").eq("tenant_id", ap.id);
const { data: contracts } = await sb.from("property_contracts").select("pm_tenant_id, unit_id").eq("tenant_id", ap.id);
const tenantsWithContract = new Set(contracts.map(c=>c.pm_tenant_id));
const unitsWithContract = new Set(contracts.map(c=>c.unit_id));
const isPh=(n)=>(n||"").toLowerCase().includes("placeholder");
const noContract = tenants.filter(t=>!isPh(t.full_name) && !tenantsWithContract.has(t.id));

const { data: units } = await sb.from("units")
  .select("id, room_number, unit_type, deposit, min_price_pcm, max_price_pcm, couples_price_pcm, pm_tenant_id, property:properties(name)")
  .in("pm_tenant_id", noContract.map(t=>t.id));
const unitByTenant = new Map((units||[]).map(u=>[u.pm_tenant_id, u]));

const toCreate = [];
const skipNoUnit = [];
const skipUnitTaken = [];

for (const t of noContract) {
  const u = unitByTenant.get(t.id);
  if (!u) { skipNoUnit.push(t); continue; }
  if (unitsWithContract.has(u.id)) { skipUnitTaken.push({t,u}); continue; }
  const rent = u.min_price_pcm ?? u.max_price_pcm ?? u.couples_price_pcm;
  const deposit = u.deposit;
  if (rent == null || deposit == null) { skipNoUnit.push(t); continue; }
  toCreate.push({
    tenant_id: ap.id,
    unit_id: u.id,
    pm_tenant_id: t.id,
    start_date: START_DATE,
    rent_pcm: rent,
    deposit: deposit,
    status: "active",
    _label: `${t.full_name} -> ${u.property?.name}/${u.room_number??u.unit_type} rent=${rent} dep=${deposit}`,
  });
}

console.log(`Tenants with no contract: ${noContract.length}`);
console.log(`Will CREATE active contracts: ${toCreate.length}\n`);
for (const c of toCreate) console.log("  +", c._label);
console.log(`\nSKIP - no unit / no rent-deposit (${skipNoUnit.length}):`);
for (const t of skipNoUnit) console.log("   -", t.full_name);
console.log(`\nSKIP - unit already has a contract (${skipUnitTaken.length}):`);
for (const s of skipUnitTaken) console.log(`   -", ${s.t.full_name} -> ${s.u.property?.name}/${s.u.room_number??s.u.unit_type} (unit already contracted)`);

if (!APPLY) { console.log("\nDRY-RUN complete. Re-run with --apply to create these contracts.\n"); process.exit(0); }

const rows = toCreate.map(({_label, ...r})=>r);
const { data: inserted, error } = await sb.from("property_contracts").insert(rows).select("id");
if (error) throw error;
console.log(`\nCreated ${inserted.length} contracts.\n`);
