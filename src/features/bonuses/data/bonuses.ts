import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

export async function getBonuses({
  status,
  search,
  landlordId,
  agentId,
  page = 1,
}: {
  status?: string;
  search?: string;
  landlordId?: string;
  agentId?: string;
  page?: number;
} = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("bonuses")
    .select(
      "id, code, bonus_date, client_name, property_address, amount_owed, payout_mode, status, landlord_id, agent_id, notes, created_at, landlords:landlords!bonuses_landlord_id_fkey(name), agent:user_profiles!bonuses_agent_id_fkey(display_name)",
      { count: "exact" }
    )
    // Newest first by creation time; id breaks ties so paging can't repeat or skip a row.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (search) {
    query = query.or(
      `code.ilike.%${search}%,client_name.ilike.%${search}%,property_address.ilike.%${search}%`
    );
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (landlordId && landlordId !== "all") {
    query = query.eq("landlord_id", landlordId);
  }
  if (agentId && agentId !== "all") {
    query = query.eq("agent_id", agentId);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    bonuses: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

/** Single bonus by id for view/edit page. */
export async function getBonusById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bonuses")
    .select(
      "id, code, bonus_date, client_name, property_address, amount_owed, payout_mode, status, landlord_id, agent_id, notes, invoice_pending, created_at, landlords:landlords!bonuses_landlord_id_fkey(name), agent:user_profiles!bonuses_agent_id_fkey(display_name)"
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Bonuses for a single agent (e.g. /me).
 *  Unpaid bonuses are always included regardless of the date range —
 *  the range only restricts paid bonuses. */
export async function getBonusesForAgent(
  agentId: string,
  filters: { from: string; to: string }
) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bonuses")
    .select(
      "id, bonus_date, client_name, property_address, amount_owed, payout_mode, status, created_at, landlord_id, landlords:landlords!bonuses_landlord_id_fkey(name)"
    )
    .eq("agent_id", agentId)
    .or(`and(bonus_date.gte.${filters.from},bonus_date.lte.${filters.to}),and(status.neq.paid,status.neq.declined)`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const bonuses = data ?? [];
  if (bonuses.length === 0) return [];

  // Linked invoice, via the junction table createInvoiceFromBonuses writes.
  // RLS on invoice_bonus_links limits non-admins to invoices they created, so
  // an agent may legitimately see no link where an admin would — the UI just
  // omits the icon rather than showing a link that would 404 on click.
  const { data: links, error: linkError } = await supabase
    .from("invoice_bonus_links")
    .select("bonus_id, invoices(id, invoice_number, status)")
    .in(
      "bonus_id",
      bonuses.map((bonus) => bonus.id)
    );
  if (linkError) throw new Error(linkError.message);

  const invoiceByBonus = new Map(
    (links ?? [])
      .map((link) => [link.bonus_id, pickOne(link.invoices)] as const)
      .filter(([, invoice]) => invoice !== null)
  );

  return bonuses.map((bonus) => ({
    ...bonus,
    landlord_name: pickOne(bonus.landlords)?.name ?? null,
    invoice: invoiceByBonus.get(bonus.id) ?? null,
  }));
}

/** Supabase embeds resolve to an object or a single-element array depending on
 *  how the relationship is inferred; normalise both to one value. */
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
