import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type {
  ExcludedWorksCost,
  OwnerStatement,
  OwnerStatementListItem,
  OwnerStatementWithLines,
  OwnerTransaction,
} from "../domain/types";

export type OwnerStatementFilters = {
  ownerId?: string;
  status?: OwnerStatement["status"];
  year?: number;
};

/** Statements for the list page, newest period first, with the owner name. */
export async function listOwnerStatements(
  filters: OwnerStatementFilters = {}
): Promise<OwnerStatementListItem[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("owner_statements")
    .select("*, owner:owner_landlords(id, name, email)")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.year) query = query.eq("period_year", filters.year);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type Row = OwnerStatement & { owner: { id: string; name: string; email: string | null } | null };
  return ((data ?? []) as unknown as Row[]).map((row) => {
    const { owner, ...statement } = row;
    return {
      ...statement,
      owner_name: owner?.name ?? "Unknown owner",
      owner_email: owner?.email ?? null,
    };
  });
}

/** Every statement for one owner — the Statements tab on /owners/[id]. */
export async function listStatementsForOwner(
  ownerId: string
): Promise<OwnerStatementListItem[]> {
  return listOwnerStatements({ ownerId });
}

/** A single statement with its owner and ledger lines, for the detail page. */
export async function getOwnerStatement(id: string): Promise<OwnerStatementWithLines | null> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: statement, error } = await supabase
    .from("owner_statements")
    .select(
      "*, owner:owner_landlords(id, name, email, phone, management_fee_type, management_fee_percent, management_fee_amount)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!statement) return null;

  const { data: txns, error: txErr } = await supabase
    .from("owner_transactions")
    .select("*")
    .eq("statement_id", id)
    .order("txn_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (txErr) throw new Error(txErr.message);

  const transactions = (txns ?? []) as unknown as OwnerTransaction[];

  const { owner, ...rest } = statement as unknown as OwnerStatement & {
    owner: OwnerStatementWithLines["owner"];
  };

  const [excludedWorks, missingRent] = await Promise.all([
    getExcludedWorksCosts(rest.owner_id, rest.period_start, rest.period_end),
    getPropertiesMissingRent(rest.owner_id),
  ]);

  // Resolve property names for grouping — both charged lines and the
  // absorbed costs listed alongside them.
  const propertyIds = [
    ...new Set(
      [
        ...transactions.map((t) => t.property_id),
        ...excludedWorks.map((c) => c.property_id),
      ].filter((v): v is string => !!v)
    ),
  ];
  const propertyNames: Record<string, string> = {};
  if (propertyIds.length > 0) {
    const { data: props } = await supabase
      .from("properties")
      .select("id, name")
      .in("id", propertyIds);
    for (const p of (props ?? []) as Array<{ id: string; name: string }>) {
      propertyNames[p.id] = p.name;
    }
  }

  return {
    ...(rest as OwnerStatement),
    owner: owner ?? null,
    transactions,
    property_names: propertyNames,
    excluded_works: excludedWorks,
    properties_missing_rent: missingRent,
  };
}

/**
 * Properties owned by this landlord with no agreed monthly rent set. Rent on a
 * statement is the contracted figure from the property, so a blank there means
 * that property silently contributes nothing — worth saying out loud.
 */
async function getPropertiesMissingRent(
  ownerId: string
): Promise<Array<{ id: string; name: string }>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, monthly_rent_owed")
    .eq("owner_landlord_id", ownerId)
    .or("monthly_rent_owed.is.null,monthly_rent_owed.eq.0")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; name: string }>).map((p) => ({
    id: p.id,
    name: p.name,
  }));
}

/**
 * Maintenance costs on this owner's properties in the period that were NOT
 * recharged. Shown under the works orders so the agency can see what it
 * absorbed — and put a cost back if it was flagged in error.
 */
async function getExcludedWorksCosts(
  ownerId: string,
  periodStart: string,
  periodEnd: string
): Promise<ExcludedWorksCost[]> {
  const supabase = createSupabaseServerClient();

  const { data: props, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_landlord_id", ownerId);
  if (propErr) throw new Error(propErr.message);
  const propertyIds = ((props ?? []) as Array<{ id: string }>).map((p) => p.id);
  if (propertyIds.length === 0) return [];

  const { data: jobs, error: jobErr } = await supabase
    .from("maintenance_jobs")
    .select("id, property_id")
    .in("property_id", propertyIds);
  if (jobErr) throw new Error(jobErr.message);
  const jobToProperty = new Map<string, string>();
  for (const j of (jobs ?? []) as Array<{ id: string; property_id: string }>) {
    jobToProperty.set(j.id, j.property_id);
  }
  if (jobToProperty.size === 0) return [];

  const { data: costs, error: costErr } = await supabase
    .from("maintenance_costs")
    .select("id, job_id, amount, description, date_incurred, supplier")
    .eq("recharge_to_owner", false)
    .in("job_id", [...jobToProperty.keys()])
    .gte("date_incurred", periodStart)
    .lte("date_incurred", periodEnd)
    .order("date_incurred", { ascending: true });
  if (costErr) throw new Error(costErr.message);

  return ((costs ?? []) as Array<{
    id: string;
    job_id: string;
    amount: number;
    description: string;
    date_incurred: string;
    supplier: string | null;
  }>).map((c) => ({
    id: c.id,
    property_id: jobToProperty.get(c.job_id) ?? null,
    description: c.description,
    supplier: c.supplier,
    amount_pence: c.amount,
    date_incurred: c.date_incurred,
  }));
}
