import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { getTransactions, type EbTransaction } from "@/lib/enablebanking";

const bodySchema = z.object({
  connection_id: z.string().uuid()
});

type ContractRow = { id: string; rent_pcm: number };

function txAmountPence(tx: EbTransaction): number | null {
  const raw = tx.transaction_amount?.amount;
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.abs(n) * 100);
}

function pickRemittance(tx: EbTransaction): string | null {
  const list = tx.remittance_information;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.filter(Boolean).join(" ").trim() || null;
}

/**
 * Within ±£5 of any active contract's rent_pcm (whole pounds).
 * Exactly one match → matched; zero or >1 → unmatched.
 */
function matchContract(amountPence: number, contracts: ContractRow[]): string | null {
  const pounds = amountPence / 100;
  const hits = contracts.filter((c) => Math.abs(Number(c.rent_pcm) - pounds) <= 5);
  return hits.length === 1 ? hits[0].id : null;
}

export async function POST(request: NextRequest) {
  const profile = await requireUserProfile();
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: connection } = await admin
    .from("ob_connections")
    .select("id, tenant_id, status, portfolio_id")
    .eq("id", parsed.data.connection_id)
    .maybeSingle();
  if (!connection || connection.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }
  if (connection.status !== "authorized") {
    return NextResponse.json({ error: "Connection is not authorized" }, { status: 409 });
  }

  const { data: accounts } = await admin
    .from("ob_accounts")
    .select("id, eb_account_uid")
    .eq("connection_id", connection.id);
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ inserted: 0, matched: 0, accounts: 0 });
  }

  // Scope the contract pool to the connection's portfolio:
  // property_contracts.unit_id → units.property_id → properties.portfolio_id
  let unitIds: string[] | null = null;
  if (connection.portfolio_id) {
    const { data: properties } = await admin
      .from("properties")
      .select("id")
      .eq("tenant_id", profile.tenant_id)
      .eq("portfolio_id", connection.portfolio_id);
    const propertyIds = (properties ?? []).map((p) => p.id as string);
    if (propertyIds.length === 0) {
      unitIds = [];
    } else {
      const { data: units } = await admin
        .from("units")
        .select("id")
        .in("property_id", propertyIds);
      unitIds = (units ?? []).map((u) => u.id as string);
    }
  }

  let contractQuery = admin
    .from("property_contracts")
    .select("id, rent_pcm")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "active");
  if (unitIds !== null) {
    if (unitIds.length === 0) {
      contractQuery = contractQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      contractQuery = contractQuery.in("unit_id", unitIds);
    }
  }
  const { data: contracts } = await contractQuery;
  const contractRows: ContractRow[] = (contracts ?? []).map((c) => ({
    id: c.id as string,
    rent_pcm: Number(c.rent_pcm ?? 0)
  }));

  let inserted = 0;
  let matchedCount = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    let transactions: EbTransaction[] = [];
    try {
      transactions = await getTransactions(account.eb_account_uid);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "sync_failed");
      continue;
    }

    const credits = transactions.filter((t) => t.credit_debit_indicator === "CRDT");
    for (const tx of credits) {
      const ebId = tx.transaction_id ?? tx.entry_reference ?? null;
      if (!ebId) continue;
      const amountPence = txAmountPence(tx);
      if (amountPence == null) continue;

      const matchedId = matchContract(amountPence, contractRows);

      const row = {
        account_id: account.id,
        tenant_id: profile.tenant_id,
        eb_transaction_id: ebId,
        booking_date: tx.booking_date ?? tx.value_date ?? null,
        amount_pence: amountPence,
        currency: tx.transaction_amount?.currency ?? null,
        credit_debit: "CRDT" as const,
        debtor_name: tx.debtor?.name ?? null,
        remittance_info: pickRemittance(tx),
        match_status: matchedId ? ("matched" as const) : ("unmatched" as const),
        matched_payment_id: matchedId,
        raw: tx as unknown as Record<string, unknown>
      };

      const { error: upsertError } = await admin
        .from("ob_transactions")
        .upsert(row, { onConflict: "eb_transaction_id" });
      if (!upsertError) {
        inserted++;
        if (matchedId) matchedCount++;
      }
    }

    await admin
      .from("ob_accounts")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", account.id);
  }

  return NextResponse.json({
    accounts: accounts.length,
    inserted,
    matched: matchedCount,
    errors: errors.length ? errors : undefined
  });
}
