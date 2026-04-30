import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type { InboxRequest, InboxRequestStatus } from "../domain/types";

export type InboxFilters = {
  status?: InboxRequestStatus | "all";
};

export async function listInboxRequests(filters: InboxFilters = {}): Promise<InboxRequest[]> {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();

  let query = supabase
    .from("tenant_communication_requests")
    .select(`
      id, tenant_id, pm_tenant_id, request_type, status, payload,
      resolution_notes, resolved_at, created_at,
      pm_tenant:pm_tenants(id, full_name, email)
    `)
    .order("created_at", { ascending: false });

  const status = filters.status ?? "pending";
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InboxRequest[];
}

export async function getInboxRequest(id: string): Promise<InboxRequest | null> {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();
  const { data, error } = await supabase
    .from("tenant_communication_requests")
    .select(`
      id, tenant_id, pm_tenant_id, request_type, status, payload,
      resolution_notes, resolved_at, created_at,
      pm_tenant:pm_tenants(id, full_name, email)
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as InboxRequest) ?? null;
}

export async function countPendingForCurrentTenant(): Promise<number> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { count, error } = await supabase
    .from("tenant_communication_requests")
    .select("id", { head: true, count: "exact" })
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

export async function countPendingForPmTenant(pmTenantId: string): Promise<number> {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();
  const { count, error } = await supabase
    .from("tenant_communication_requests")
    .select("id", { head: true, count: "exact" })
    .eq("pm_tenant_id", pmTenantId)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}
