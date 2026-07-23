import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of raw.split("\n")) { const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
const { data: agencies } = await sb.from("tenants").select("id, name");
const aname = new Map(agencies.map(a=>[a.id,a.name]));
const { data: tenants } = await sb.from("pm_tenants").select("id, full_name, tenant_id");
const { data: contracts } = await sb.from("property_contracts").select("id, pm_tenant_id, status, tenant_id");
const isPh=(n)=>(n||"").toLowerCase().includes("placeholder");
const withContract = new Set(contracts.map(c=>c.pm_tenant_id));

console.log("=== Placeholder pm_tenants by agency ===");
const phByAg={}; for(const t of tenants.filter(t=>isPh(t.full_name))) phByAg[t.tenant_id]=(phByAg[t.tenant_id]||0)+1;
for(const [k,v] of Object.entries(phByAg)) console.log(`  ${aname.get(k)||k}: ${v}`);

console.log("\n=== Contracts by agency + status ===");
const cByAg={}; for(const c of contracts){cByAg[c.tenant_id]=cByAg[c.tenant_id]||{}; cByAg[c.tenant_id][c.status]=(cByAg[c.tenant_id][c.status]||0)+1;}
for(const [k,v] of Object.entries(cByAg)) console.log(`  ${aname.get(k)||k}: ${JSON.stringify(v)}`);

console.log("\n=== Real (non-placeholder) tenants by agency: total / withContract / noContract ===");
const real=tenants.filter(t=>!isPh(t.full_name));
const g={};
for(const t of real){ g[t.tenant_id]=g[t.tenant_id]||{total:0,with:0,no:0}; g[t.tenant_id].total++; if(withContract.has(t.id))g[t.tenant_id].with++; else g[t.tenant_id].no++; }
for(const [k,v] of Object.entries(g)) console.log(`  ${aname.get(k)||k}: total=${v.total} withContract=${v.with} noContract=${v.no}`);
