import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { sanitizeFilterTerm } from "@/lib/utils/search";
import type { LeadWithRelations } from "../domain/types";

const PAGE_SIZE = 15;

export async function getLeads({
  search,
  status,
  source,
  ref,
  page = 1,
}: {
  search?: string;
  status?: string;
  source?: string;
  ref?: string;
  page?: number;
}) {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();

  let query = supabase
    .from("leads")
    .select(
      "*, assigned_agent:user_profiles!assigned_to(id, display_name), listing:scraped_listings!listing_id(id, title, url)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    const term = sanitizeFilterTerm(search);
    if (term) {
      query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,telephone.ilike.%${term}%`);
    }
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (source && source !== "all") {
    query = query.eq("source", source);
  }
  if (ref) {
    const refTerm = sanitizeFilterTerm(ref);
    if (refTerm) {
      query = query.ilike("property_ref", `%${refTerm}%`);
    }
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    leads: (data ?? []) as LeadWithRelations[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

/**
 * Stamp clicked_at the first time a lead is opened, so the list can show which
 * leads have been read. No-op once already set (only rows with a null
 * clicked_at are touched).
 */
export async function markLeadClicked(id: string) {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();

  await supabase
    .from("leads")
    .update({ clicked_at: new Date().toISOString() })
    .eq("id", id)
    .is("clicked_at", null);
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
  return data as LeadWithRelations;
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
