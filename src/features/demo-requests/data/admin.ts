import "server-only";

import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEMO_REQUEST_STATUSES, type DemoRequest } from "../domain/types";

// Platform-side reads. Service role behind requireSuperAdmin() — re-checked here even though the
// /admin layout already gates, per the admin convention.

const COLUMNS =
  "id, first_name, last_name, email, company, portfolio_size, goal, plan_interest, status, admin_notes, team_notified_at, confirmation_sent_at, created_at, updated_at";

export type DemoRequestQueue = {
  requests: DemoRequest[];
  counts: { new: number; lastWeek: number; total: number };
  /** True when the table is missing — migration not yet applied. */
  unavailable: boolean;
};

/** `status`: a DemoRequestStatus, "open" (new, contacted or booked; the default) or "all". */
export async function listDemoRequests({ status = "open" }: { status?: string } = {}): Promise<DemoRequestQueue> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  let query = admin.from("demo_requests").select(COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (status === "open") query = query.in("status", ["new", "contacted", "booked"]);
  else if ((DEMO_REQUEST_STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const [list, fresh, lastWeek, total] = await Promise.all([
    query,
    admin.from("demo_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("demo_requests").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    admin.from("demo_requests").select("id", { count: "exact", head: true }),
  ]);

  if (list.error) {
    return { requests: [], counts: { new: 0, lastWeek: 0, total: 0 }, unavailable: true };
  }
  return {
    requests: (list.data ?? []) as DemoRequest[],
    counts: { new: fresh.count ?? 0, lastWeek: lastWeek.count ?? 0, total: total.count ?? 0 },
    unavailable: false,
  };
}

export type DemoRequestLookup =
  | { state: "found"; request: DemoRequest }
  | { state: "missing" }
  | { state: "unavailable" };

export async function getDemoRequest(id: string): Promise<DemoRequestLookup> {
  await requireSuperAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { state: "missing" };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("demo_requests").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return { state: "unavailable" };
  if (!data) return { state: "missing" };
  return { state: "found", request: data as DemoRequest };
}
