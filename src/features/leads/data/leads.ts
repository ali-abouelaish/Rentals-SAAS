import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type { Lead } from "../domain/types";

const PAGE_SIZE = 15;

export async function getLeads({
  search,
  status,
  source,
  page = 1,
}: {
  search?: string;
  status?: string;
  source?: string;
  page?: number;
}) {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();

  let query = supabase
    .from("leads")
    .select(
      "*, assigned_agent:user_profiles!assigned_to(display_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,telephone.ilike.%${search}%`);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (source && source !== "all") {
    query = query.eq("source", source);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    leads: (data ?? []) as (Lead & { assigned_agent: { display_name: string | null } | null })[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getLeadById(id: string) {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();

  const { data, error } = await supabase
    .from("leads")
    .select(
      "*, assigned_agent:user_profiles!assigned_to(id, display_name), listing:scraped_listings!listing_id(id, title, url)"
    )
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Lead & {
    assigned_agent: { id: string; display_name: string | null } | null;
    listing: { id: string; title: string | null; url: string | null } | null;
  };
}

export type LeadStats = {
  todayCount: number;
  totalNew: number;
  lastLeadAt: string | null;
};

export async function getLeadStats(): Promise<LeadStats> {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: todayCount }, { count: totalNew }, { data: lastLead }] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString()),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("leads")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    todayCount: todayCount ?? 0,
    totalNew: totalNew ?? 0,
    lastLeadAt: lastLead?.created_at ?? null,
  };
}
