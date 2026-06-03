import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { MdProtection, MdReleaseRequest, MydepositsConnection } from "../domain/types";

const PROTECTION_SELECT = `*,
  contract:property_contracts(
    id, deposit, deposit_scheme, start_date, expiry_date, rent_pcm,
    pm_tenant:pm_tenants(full_name, email, phone),
    unit:units(
      room_number, unit_type,
      property:properties(name, address_line_1)
    )
  )`;

/**
 * The connection row is service-role only (no RLS policies). Reads go through
 * the admin client but are explicitly scoped to the caller's tenant. Tokens are
 * never returned to the client.
 */
export async function getConnection(): Promise<MydepositsConnection | null> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("mydeposits_connections")
    .select("tenant_id, environment, account_label, token_expiry, connected_by, last_synced_at, created_at, updated_at")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  return (data as MydepositsConnection | null) ?? null;
}

export async function listProtections(): Promise<MdProtection[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("mydeposits_protections")
    .select(PROTECTION_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MdProtection[];
}

export async function getProtectionByContract(contractId: string): Promise<MdProtection | null> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("mydeposits_protections")
    .select(PROTECTION_SELECT)
    .eq("contract_id", contractId)
    .maybeSingle();
  return (data as MdProtection | null) ?? null;
}

export async function getProtectionById(id: string): Promise<MdProtection | null> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("mydeposits_protections")
    .select(PROTECTION_SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as MdProtection | null) ?? null;
}

export async function listReleaseRequests(): Promise<MdReleaseRequest[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("mydeposits_release_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MdReleaseRequest[];
}

export async function getReleaseRequestsForProtection(protectionId: string): Promise<MdReleaseRequest[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("mydeposits_release_requests")
    .select("*")
    .eq("protection_id", protectionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MdReleaseRequest[];
}
