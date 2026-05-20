import type { SupabaseClient } from "@supabase/supabase-js";

type Sb = SupabaseClient<any, "public", any>;

interface CandidateContract {
  id: string;
  rent_pcm: number;
  pm_tenant_id: string;
  unit_id: string;
  tenant_name: string;
  address: string;
  manager_landlord_id: string | null;
  landlord_name: string | null;
  portfolio_id: string | null;
  portfolio_name: string | null;
}

interface CreditRow {
  id: string;
  description: string | null;
  amount_pence: number;
}

interface MatchRow {
  id: string;
  match_status: "matched" | "flagged" | "unmatched";
  matched_contract_id: string | null;
  matched_tenant_name: string | null;
}

function tokenizeName(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function descriptionContainsAnyToken(description: string, tokens: string[]): boolean {
  const lower = description.toLowerCase();
  return tokens.some((t) => lower.includes(t));
}

function scoreCandidate(credit: CreditRow, contract: CandidateContract): number {
  let score = 0;
  const expectedPence = Math.round(contract.rent_pcm * 100);
  const diff = Math.abs(credit.amount_pence - expectedPence);

  if (diff <= 500) score += 2;
  if (diff === 0) score += 1;

  const tokens = tokenizeName(contract.tenant_name);
  if (descriptionContainsAnyToken(credit.description ?? "", tokens)) {
    score += 2;
  }

  return score;
}

async function fetchCandidateContracts(
  supabase: Sb,
  tenantId: string,
  portfolioId: string,
  statementTo: string | null,
): Promise<CandidateContract[]> {
  const { data, error } = await supabase
    .from("property_contracts")
    .select(
      `
        id, rent_pcm, pm_tenant_id, unit_id, start_date, status,
        pm_tenant:pm_tenants(full_name),
        unit:units!inner(
          property:properties!inner(
            address_line_1, portfolio_id, manager_landlord_id,
            manager_landlord:manager_landlords(id, full_name),
            portfolio:portfolios(id, name)
          )
        )
      `,
    )
    .eq("tenant_id", tenantId)
    .in("status", ["active", "signed", "notice_given"])
    .eq("unit.property.portfolio_id", portfolioId);

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    rent_pcm: number;
    pm_tenant_id: string;
    unit_id: string;
    start_date: string;
    pm_tenant: { full_name: string } | null;
    unit: {
      property: {
        address_line_1: string;
        portfolio_id: string | null;
        manager_landlord_id: string | null;
        manager_landlord: { id: string; full_name: string } | null;
        portfolio: { id: string; name: string } | null;
      } | null;
    } | null;
  };

  const rows = (data ?? []) as unknown as Row[];
  const limit = statementTo ? new Date(statementTo) : null;

  return rows
    .filter((row) => {
      if (!row.unit?.property) return false;
      if (!limit) return true;
      return new Date(row.start_date) <= limit;
    })
    .map((row) => ({
      id: row.id,
      rent_pcm: row.rent_pcm,
      pm_tenant_id: row.pm_tenant_id,
      unit_id: row.unit_id,
      tenant_name: row.pm_tenant?.full_name ?? "",
      address: row.unit?.property?.address_line_1 ?? "",
      manager_landlord_id: row.unit?.property?.manager_landlord_id ?? null,
      landlord_name: row.unit?.property?.manager_landlord?.full_name ?? null,
      portfolio_id: row.unit?.property?.portfolio_id ?? null,
      portfolio_name: row.unit?.property?.portfolio?.name ?? null,
    }));
}

export async function matchCredits(
  supabase: Sb,
  uploadId: string,
  tenantId: string,
  portfolioId: string,
  statementTo: string | null,
): Promise<{ matched: number; flagged: number; unmatched: number }> {
  const { data: credits, error: cErr } = await supabase
    .from("bank_transactions")
    .select("id, description, amount_pence")
    .eq("upload_id", uploadId)
    .eq("transaction_type", "credit");

  if (cErr) throw new Error(cErr.message);
  const creditRows = (credits ?? []) as CreditRow[];

  if (creditRows.length === 0) {
    return { matched: 0, flagged: 0, unmatched: 0 };
  }

  const contracts = await fetchCandidateContracts(supabase, tenantId, portfolioId, statementTo);

  const updates: MatchRow[] = [];
  let matched = 0;
  let flagged = 0;
  let unmatched = 0;

  for (const credit of creditRows) {
    const scored = contracts
      .map((c) => ({ contract: c, score: scoreCandidate(credit, c) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0 || scored[0].score < 2) {
      updates.push({ id: credit.id, match_status: "unmatched", matched_contract_id: null, matched_tenant_name: null });
      unmatched++;
      continue;
    }

    const top = scored[0];
    const tied = scored.filter((s) => s.score === top.score);

    if (tied.length > 1) {
      updates.push({ id: credit.id, match_status: "flagged", matched_contract_id: null, matched_tenant_name: null });
      flagged++;
    } else {
      updates.push({
        id: credit.id,
        match_status: "matched",
        matched_contract_id: top.contract.id,
        matched_tenant_name: top.contract.tenant_name,
      });
      matched++;
    }
  }

  for (const upd of updates) {
    const { error } = await supabase
      .from("bank_transactions")
      .update({
        match_status: upd.match_status,
        matched_contract_id: upd.matched_contract_id,
        matched_tenant_name: upd.matched_tenant_name,
      })
      .eq("id", upd.id);
    if (error) throw new Error(error.message);
  }

  return { matched, flagged, unmatched };
}

export async function checkMissingRentPayments(
  supabase: Sb,
  uploadId: string,
  tenantId: string,
  portfolioId: string,
  statementFrom: string,
  statementTo: string,
): Promise<number> {
  const contracts = await fetchCandidateContracts(supabase, tenantId, portfolioId, statementTo);

  if (contracts.length === 0) return 0;

  const contractIds = contracts.map((c) => c.id);

  const { data: matchedTx, error: mErr } = await supabase
    .from("bank_transactions")
    .select("matched_contract_id")
    .eq("upload_id", uploadId)
    .in("matched_contract_id", contractIds)
    .gte("transaction_date", statementFrom)
    .lte("transaction_date", statementTo);

  if (mErr) throw new Error(mErr.message);

  const paidIds = new Set(
    ((matchedTx ?? []) as Array<{ matched_contract_id: string | null }>)
      .map((r) => r.matched_contract_id)
      .filter((v): v is string => Boolean(v)),
  );

  const flagsToInsert = contracts
    .filter((c) => !paidIds.has(c.id))
    .map((c) => ({
      upload_id: uploadId,
      tenant_id: tenantId,
      contract_id: c.id,
      manager_landlord_id: c.manager_landlord_id,
      landlord_name: c.landlord_name ?? "Unassigned landlord",
      portfolio_id: c.portfolio_id,
      portfolio_name: c.portfolio_name ?? "Ungrouped",
      tenant_name: c.tenant_name,
      property_address: c.address,
      expected_amount_pence: Math.round(c.rent_pcm * 100),
      flag_type: "missing_rent",
    }));

  if (flagsToInsert.length === 0) return 0;

  const { error } = await supabase.from("rent_payment_flags").insert(flagsToInsert);
  if (error) throw new Error(error.message);

  return flagsToInsert.length;
}
