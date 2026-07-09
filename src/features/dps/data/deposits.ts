import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { DpsDeposit } from "../domain/deposit-types";

const DEPOSIT_SELECT = `*,
  contract:property_contracts(
    id, deposit, deposit_scheme, deposit_scheme_ref, deposit_protected_date, start_date, expiry_date,
    pm_tenant:pm_tenants(full_name, email, phone),
    unit:units(
      room_number, unit_type,
      property:properties(name, address_line_1)
    )
  )`;

export async function listDpsDeposits(): Promise<DpsDeposit[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dps_deposits")
    .select(DEPOSIT_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DpsDeposit[];
}

export async function getDpsDepositByContract(contractId: string): Promise<DpsDeposit | null> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("dps_deposits")
    .select(DEPOSIT_SELECT)
    .eq("contract_id", contractId)
    .maybeSingle();
  return (data as DpsDeposit | null) ?? null;
}

/**
 * Whether the caller's tenant has DPS credentials configured. dps_connections
 * is service-role only (no RLS policies), so this reads via the admin client
 * but is explicitly scoped to the caller's tenant. The secret client_secret is
 * never selected.
 */
export type DpsConnectionSummary = {
  environment: string;
  agent_landlord_id: string;
  last_verified_at: string | null;
  last_error: string | null;
} | null;

export async function getDpsConnectionSummary(): Promise<DpsConnectionSummary> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("dps_connections")
    .select("environment, agent_landlord_id, last_verified_at, last_error")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  return (data as DpsConnectionSummary) ?? null;
}
