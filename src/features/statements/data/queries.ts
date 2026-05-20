import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

export interface PortfolioOption {
  id: string;
  name: string;
}

export async function listPortfolios(): Promise<PortfolioOption[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PortfolioOption[];
}

export interface StatementUploadRow {
  id: string;
  filename: string;
  bank_name: string | null;
  file_format: string | null;
  statement_from: string | null;
  statement_to: string | null;
  total_credits: number;
  status: string;
  error_message: string | null;
  uploaded_at: string;
  portfolio: { id: string; name: string } | null;
  matched_count: number;
  missing_count: number;
}

export async function listStatementUploads(): Promise<StatementUploadRow[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: uploads, error } = await supabase
    .from("bank_statement_uploads")
    .select(
      `
        id, filename, bank_name, file_format, statement_from, statement_to,
        total_credits, status, error_message, uploaded_at,
        portfolio:portfolios(id, name)
      `,
    )
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (uploads ?? []) as unknown as Array<
    Omit<StatementUploadRow, "matched_count" | "missing_count">
  >;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const { data: matchedAgg, error: mErr } = await supabase
    .from("bank_transactions")
    .select("upload_id, match_status")
    .in("upload_id", ids)
    .eq("transaction_type", "credit");
  if (mErr) throw new Error(mErr.message);

  const matchedByUpload = new Map<string, number>();
  for (const row of (matchedAgg ?? []) as Array<{ upload_id: string; match_status: string }>) {
    if (row.match_status === "matched") {
      matchedByUpload.set(row.upload_id, (matchedByUpload.get(row.upload_id) ?? 0) + 1);
    }
  }

  const { data: flagsAgg, error: fErr } = await supabase
    .from("rent_payment_flags")
    .select("upload_id")
    .in("upload_id", ids)
    .eq("resolved", false);
  if (fErr) throw new Error(fErr.message);

  const missingByUpload = new Map<string, number>();
  for (const row of (flagsAgg ?? []) as Array<{ upload_id: string }>) {
    missingByUpload.set(row.upload_id, (missingByUpload.get(row.upload_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    ...r,
    matched_count: matchedByUpload.get(r.id) ?? 0,
    missing_count: missingByUpload.get(r.id) ?? 0,
  }));
}

export interface StatementTransaction {
  id: string;
  transaction_date: string;
  description: string | null;
  amount_pence: number;
  transaction_type: "credit" | "debit";
  balance_pence: number | null;
  reference: string | null;
  match_status: "unmatched" | "matched" | "flagged";
  matched_contract_id: string | null;
  matched_tenant_name: string | null;
}

export async function getUploadTransactions(uploadId: string): Promise<StatementTransaction[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bank_transactions")
    .select(
      `id, transaction_date, description, amount_pence, transaction_type, balance_pence, reference,
       match_status, matched_contract_id, matched_tenant_name`,
    )
    .eq("upload_id", uploadId)
    .order("transaction_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StatementTransaction[];
}

export interface FlagsGrouped {
  portfolio_name: string | null;
  landlords: Array<{
    manager_landlord_id: string | null;
    landlord_name: string;
    missing_count: number;
    flags: Array<{
      id: string;
      tenant_name: string | null;
      property_address: string | null;
      expected_amount_pence: number | null;
      contract_id: string;
    }>;
  }>;
  total_missing: number;
  resolved_count: number;
}

export async function getUploadFlags(uploadId: string): Promise<FlagsGrouped> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: upload, error: uErr } = await supabase
    .from("bank_statement_uploads")
    .select("portfolio:portfolios(name)")
    .eq("id", uploadId)
    .single();
  if (uErr) throw new Error(uErr.message);
  const portfolio = (upload as unknown as { portfolio: { name: string } | null } | null)?.portfolio;

  const { data: flags, error } = await supabase
    .from("rent_payment_flags")
    .select(
      "id, manager_landlord_id, landlord_name, portfolio_id, portfolio_name, tenant_name, property_address, expected_amount_pence, contract_id, resolved",
    )
    .eq("upload_id", uploadId);
  if (error) throw new Error(error.message);

  const all = (flags ?? []) as Array<{
    id: string;
    manager_landlord_id: string | null;
    landlord_name: string | null;
    portfolio_id: string | null;
    portfolio_name: string | null;
    tenant_name: string | null;
    property_address: string | null;
    expected_amount_pence: number | null;
    contract_id: string;
    resolved: boolean;
  }>;

  const open = all.filter((f) => !f.resolved);
  const resolved = all.length - open.length;

  const byLandlord = new Map<string, FlagsGrouped["landlords"][number]>();
  for (const f of open) {
    const key = f.manager_landlord_id ?? "unassigned";
    const name = f.landlord_name ?? "Unassigned landlord";
    if (!byLandlord.has(key)) {
      byLandlord.set(key, {
        manager_landlord_id: f.manager_landlord_id,
        landlord_name: name,
        missing_count: 0,
        flags: [],
      });
    }
    const bucket = byLandlord.get(key)!;
    bucket.missing_count += 1;
    bucket.flags.push({
      id: f.id,
      tenant_name: f.tenant_name,
      property_address: f.property_address,
      expected_amount_pence: f.expected_amount_pence,
      contract_id: f.contract_id,
    });
  }

  return {
    portfolio_name: portfolio?.name ?? null,
    landlords: Array.from(byLandlord.values()).sort((a, b) => {
      if (a.landlord_name === "Unassigned landlord") return 1;
      if (b.landlord_name === "Unassigned landlord") return -1;
      return a.landlord_name.localeCompare(b.landlord_name);
    }),
    total_missing: open.length,
    resolved_count: resolved,
  };
}
