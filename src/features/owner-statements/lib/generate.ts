// Owner-statement generation core. Plain server module (no "use server") so it
// can be imported by both the server actions (session context) and the cron job
// (admin client, no session). Money is INTEGER PENCE.

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAgencyBrand } from "@/lib/branding/agency-brand";
import { OwnerStatementPdf } from "../pdf/OwnerStatementPdf";
import {
  monthBounds,
  monthLabel,
  monthlyRentOwedPence,
  closingBalance,
  computeManagementFeePence,
  effectiveFeeConfig,
  managementFeeLabel,
  summariseTransactions,
} from "../domain/derive";
import type { ManagementFeeConfig, OwnerStatement, OwnerTransaction } from "../domain/types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

const STATEMENTS_BUCKET = "owner-statements-pdf";

async function ensureBucketExists(admin: Admin, bucketName: string) {
  const { error } = await admin.storage.getBucket(bucketName);
  if (error) {
    await admin.storage.createBucket(bucketName, { public: false });
  }
}

export type GenerateParams = {
  tenantId: string;
  ownerId: string;
  year: number;
  month: number;
  createdBy?: string | null;
};

export type GenerateResult = {
  statementId: string;
  status: "generated" | "skipped_locked";
};

/**
 * Generate (or regenerate) an owner statement for one owner + period.
 *
 * Idempotent: re-running refreshes derived lines (rent, works, fee) while
 * preserving manual adjustments; a statement already 'sent' or 'void' is left
 * untouched. Uses the admin client so cron (no session) can call it.
 *
 * The statement is PROPERTY-level throughout. Rent is the contracted amount
 * owed on each property, never the tenants' individual payments — a landlord
 * has no business seeing room-level collection detail, and under a rent-to-rent
 * deal the agency owes the agreed rent regardless.
 */
export async function generateStatementForOwner(
  admin: Admin,
  { tenantId, ownerId, year, month, createdBy = null }: GenerateParams
): Promise<GenerateResult> {
  const { startStr, endStr } = monthBounds(year, month);

  // ── Owner + fee config ──
  const { data: owner, error: ownerErr } = await admin
    .from("owner_landlords")
    .select("id, tenant_id, management_fee_type, management_fee_percent, management_fee_amount")
    .eq("id", ownerId)
    .maybeSingle();
  if (ownerErr) throw new Error(ownerErr.message);
  if (!owner || owner.tenant_id !== tenantId) throw new Error("Owner not found.");

  const feeConfig: ManagementFeeConfig = {
    type: (owner.management_fee_type ?? "none") as ManagementFeeConfig["type"],
    percent: owner.management_fee_percent as number | null,
    amount: owner.management_fee_amount as number | null,
  };

  // ── Owner's properties ──
  const { data: propRows, error: propErr } = await admin
    .from("properties")
    .select("id, name, monthly_rent_owed, payment_schedule")
    .eq("tenant_id", tenantId)
    .eq("owner_landlord_id", ownerId);
  if (propErr) throw new Error(propErr.message);
  const properties = (propRows ?? []) as Array<{
    id: string;
    name: string;
    monthly_rent_owed: number | null;
    payment_schedule: "monthly" | "quarterly" | "biannual" | "annual" | null;
  }>;
  const propertyIds = properties.map((p) => p.id);

  // ── Existing statement? (idempotency + lock check) ──
  const { data: existing, error: exErr } = await admin
    .from("owner_statements")
    .select("id, status, fee_override_type, fee_override_percent, fee_override_amount")
    .eq("tenant_id", tenantId)
    .eq("owner_id", ownerId)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);

  if (existing && (existing.status === "sent" || existing.status === "void")) {
    return { statementId: existing.id as string, status: "skipped_locked" };
  }

  // A fee override set on a previous run must survive regeneration.
  const feeOverride = existing
    ? {
        type: existing.fee_override_type as ManagementFeeConfig["type"] | null,
        percent: existing.fee_override_percent as number | null,
        amount: existing.fee_override_amount as number | null,
      }
    : null;

  // Resolve the statement id (create the shell if new).
  let statementId: string;
  if (existing) {
    statementId = existing.id as string;
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("owner_statements")
      .insert({
        tenant_id: tenantId,
        owner_id: ownerId,
        period_year: year,
        period_month: month,
        period_start: startStr,
        period_end: endStr,
        status: "draft",
        created_by: createdBy,
      })
      .select("id")
      .single();
    if (insErr) {
      // Lost a concurrent insert race — re-read the winner.
      if ((insErr as { code?: string }).code !== "23505") throw new Error(insErr.message);
      const { data: winner, error: winErr } = await admin
        .from("owner_statements")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .eq("owner_id", ownerId)
        .eq("period_year", year)
        .eq("period_month", month)
        .single();
      if (winErr) throw new Error(winErr.message);
      if (winner.status === "sent" || winner.status === "void") {
        return { statementId: winner.id as string, status: "skipped_locked" };
      }
      statementId = winner.id as string;
    } else {
      statementId = inserted.id as string;
    }
  }

  // ── Replace derived lines (preserve manual adjustments) ──
  await admin
    .from("owner_transactions")
    .delete()
    .eq("statement_id", statementId)
    .in("source_kind", ["rent_payment", "maintenance_cost", "computed"]);

  const derived: Array<Record<string, unknown>> = [];

  if (propertyIds.length > 0) {
    // ── Rent owed to the landlord, one line per property ──
    //
    // Deliberately NOT built from rent_payments. Under a rent-to-rent deal the
    // agency owes the agreed rent whether or not the rooms are let, so what the
    // tenants actually paid is the agency's business, not the landlord's —
    // showing it would also leak room-level detail (who paid what and when,
    // which rooms are void). Voids and arrears stay on the agency's P&L in
    // Finances, where the mirror-image `owner_rent` cost uses this same figure.
    //
    // Dated to the period end because a contracted amount has no payment date.
    for (const p of properties) {
      const amountPence = monthlyRentOwedPence(p.monthly_rent_owed, p.payment_schedule);
      if (amountPence <= 0) continue; // No agreed rent recorded — surfaced in the UI.
      derived.push({
        tenant_id: tenantId,
        owner_id: ownerId,
        property_id: p.id,
        contract_id: null,
        statement_id: statementId,
        txn_date: endStr,
        type: "rent_due",
        direction: "in",
        amount_pence: amountPence,
        category: "rent",
        description: "Monthly rent",
        source_kind: "computed",
        source_id: p.id,
        reconciled: false,
        is_manual: false,
      });
    }

    // Works orders — maintenance costs in the period (amount already PENCE).
    // Only costs flagged rechargeable reach the owner; tenant-fault damage and
    // work the agency absorbs are excluded at source via recharge_to_owner.
    const { data: jobRows } = await admin
      .from("maintenance_jobs")
      .select("id, property_id")
      .in("property_id", propertyIds);
    const jobToProperty = new Map<string, string>();
    for (const j of (jobRows ?? []) as Array<{ id: string; property_id: string }>) {
      jobToProperty.set(j.id, j.property_id);
    }
    const jobIds = [...jobToProperty.keys()];
    if (jobIds.length > 0) {
      const { data: costs } = await admin
        .from("maintenance_costs")
        .select("id, job_id, amount, description, date_incurred, supplier")
        .eq("tenant_id", tenantId)
        .eq("recharge_to_owner", true)
        .in("job_id", jobIds)
        .gte("date_incurred", startStr)
        .lte("date_incurred", endStr);
      for (const c of (costs ?? []) as Array<{
        id: string;
        job_id: string;
        amount: number;
        description: string;
        date_incurred: string;
        supplier: string | null;
      }>) {
        derived.push({
          tenant_id: tenantId,
          owner_id: ownerId,
          property_id: jobToProperty.get(c.job_id) ?? null,
          contract_id: null,
          statement_id: statementId,
          txn_date: c.date_incurred,
          type: "works_order",
          direction: "out",
          amount_pence: c.amount,
          category: "maintenance",
          description: c.supplier ? `${c.description} (${c.supplier})` : c.description,
          source_kind: "maintenance_cost",
          source_id: c.id,
          reconciled: false,
          is_manual: false,
        });
      }
    }
  }

  // Management fee — a percentage fee applies to the rent owed for the period,
  // using the statement's own override when one has been set, else the deal.
  const rentBasePence = derived
    .filter((d) => d.type === "rent_due")
    .reduce((s, d) => s + (d.amount_pence as number), 0);
  const { config: appliedFee, isOverridden } = effectiveFeeConfig(feeConfig, feeOverride);
  const feePence = computeManagementFeePence(appliedFee, rentBasePence);
  if (feePence > 0) {
    const feeLabel = managementFeeLabel(appliedFee, isOverridden);
    derived.push({
      tenant_id: tenantId,
      owner_id: ownerId,
      property_id: null,
      contract_id: null,
      statement_id: statementId,
      txn_date: endStr,
      type: "management_fee",
      direction: "out",
      amount_pence: feePence,
      category: "fee",
      description: feeLabel,
      source_kind: "computed",
      source_id: statementId,
      reconciled: false,
      is_manual: false,
    });
  }

  if (derived.length > 0) {
    const { error: insLineErr } = await admin.from("owner_transactions").insert(derived);
    if (insLineErr && (insLineErr as { code?: string }).code !== "23505") {
      throw new Error(insLineErr.message);
    }
  }

  // ── Recompute totals + balances from ALL lines on the statement ──
  const { data: allLines } = await admin
    .from("owner_transactions")
    .select("type, direction, amount_pence")
    .eq("statement_id", statementId);
  const totals = summariseTransactions(
    (allLines ?? []) as Array<Pick<OwnerTransaction, "type" | "direction" | "amount_pence">>
  );

  const opening = await priorClosingBalance(admin, tenantId, ownerId, year, month);
  const closing = closingBalance(opening, totals);

  const { error: updErr } = await admin
    .from("owner_statements")
    .update({
      period_start: startStr,
      period_end: endStr,
      opening_balance_pence: opening,
      closing_balance_pence: closing,
      total_rent_received_pence: totals.rent,
      total_management_fee_pence: totals.fee,
      total_works_pence: totals.works,
      total_other_pence: totals.other,
      net_to_owner_pence: totals.netToOwner,
      generated_at: new Date().toISOString(),
    })
    .eq("id", statementId);
  if (updErr) throw new Error(updErr.message);

  await renderAndStoreStatementPdf(admin, statementId);

  return { statementId, status: "generated" };
}

/** Most recent prior (non-void) statement's closing balance (pence), else 0. */
async function priorClosingBalance(
  admin: Admin,
  tenantId: string,
  ownerId: string,
  year: number,
  month: number
): Promise<number> {
  const { data: prior } = await admin
    .from("owner_statements")
    .select("closing_balance_pence")
    .eq("tenant_id", tenantId)
    .eq("owner_id", ownerId)
    .neq("status", "void")
    .or(`period_year.lt.${year},and(period_year.eq.${year},period_month.lt.${month})`)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (prior?.closing_balance_pence as number | undefined) ?? 0;
}

/**
 * Recompute every statement AFTER the given period for one owner.
 *
 * Opening balances chain period to period, so changing or voiding one
 * statement invalidates every later one. Without this, voiding a mid-chain
 * period silently left later statements opening from a stale balance. Already
 * sent statements are skipped — they are a record of what the owner received
 * and must not change retrospectively.
 */
export async function recomputeChainFrom(
  admin: Admin,
  tenantId: string,
  ownerId: string,
  year: number,
  month: number
): Promise<{ recomputed: number; skippedSent: number }> {
  const { data: later, error } = await admin
    .from("owner_statements")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("owner_id", ownerId)
    .neq("status", "void")
    .or(`period_year.gt.${year},and(period_year.eq.${year},period_month.gt.${month})`)
    .order("period_year", { ascending: true })
    .order("period_month", { ascending: true });
  if (error) throw new Error(error.message);

  let recomputed = 0;
  let skippedSent = 0;
  // Sequential: each statement's opening balance depends on the one before it.
  for (const row of (later ?? []) as Array<{ id: string; status: string }>) {
    if (row.status === "sent") {
      skippedSent += 1;
      continue;
    }
    await recomputeStatement(admin, row.id);
    recomputed += 1;
  }
  return { recomputed, skippedSent };
}

/**
 * Recompute cached totals + balances from the statement's existing lines and
 * re-render the PDF, WITHOUT re-deriving from source tables. Used after manual
 * adjustment lines are added or removed.
 */
export async function recomputeStatement(admin: Admin, statementId: string): Promise<void> {
  const { data: st, error } = await admin
    .from("owner_statements")
    .select("id, tenant_id, owner_id, period_year, period_month")
    .eq("id", statementId)
    .single();
  if (error || !st) throw new Error(error?.message ?? "Statement not found.");

  const { data: allLines } = await admin
    .from("owner_transactions")
    .select("type, direction, amount_pence")
    .eq("statement_id", statementId);
  const totals = summariseTransactions(
    (allLines ?? []) as Array<Pick<OwnerTransaction, "type" | "direction" | "amount_pence">>
  );

  const opening = await priorClosingBalance(
    admin,
    st.tenant_id as string,
    st.owner_id as string,
    st.period_year as number,
    st.period_month as number
  );
  const closing = closingBalance(opening, totals);

  const { error: updErr } = await admin
    .from("owner_statements")
    .update({
      opening_balance_pence: opening,
      closing_balance_pence: closing,
      total_rent_received_pence: totals.rent,
      total_management_fee_pence: totals.fee,
      total_works_pence: totals.works,
      total_other_pence: totals.other,
      net_to_owner_pence: totals.netToOwner,
      generated_at: new Date().toISOString(),
    })
    .eq("id", statementId);
  if (updErr) throw new Error(updErr.message);

  await renderAndStoreStatementPdf(admin, statementId);
}

/** Render the statement PDF and upload it to the private bucket; returns the path. */
export async function renderAndStoreStatementPdf(
  admin: Admin,
  statementId: string
): Promise<string> {
  const { data: statement, error } = await admin
    .from("owner_statements")
    .select("*, owner:owner_landlords(name, email, phone, address)")
    .eq("id", statementId)
    .single();
  if (error || !statement) throw new Error(error?.message ?? "Statement not found.");

  const { data: lineRows } = await admin
    .from("owner_transactions")
    .select("*")
    .eq("statement_id", statementId)
    .order("txn_date", { ascending: true })
    .order("created_at", { ascending: true });
  const lines = (lineRows ?? []) as OwnerTransaction[];

  const propertyIds = [
    ...new Set(lines.map((l) => l.property_id).filter((v): v is string => !!v)),
  ];
  const propertyNames: Record<string, string> = {};
  if (propertyIds.length > 0) {
    const { data: props } = await admin.from("properties").select("id, name").in("id", propertyIds);
    for (const p of (props ?? []) as Array<{ id: string; name: string }>) {
      propertyNames[p.id] = p.name;
    }
  }

  const tenantId = statement.tenant_id as string;
  // Reads the LIVE branding table (what the admin branding screen writes),
  // falling back to the older tenants.branding jsonb. Logo validation and
  // colour sanitising happen in there — see loadAgencyBrand.
  const brand = await loadAgencyBrand(tenantId);
  if (!brand) throw new Error("Agency not found.");

  const { owner, ...stmt } = statement as unknown as OwnerStatement & {
    owner: {
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
    } | null;
  };

  const buffer = await renderToBuffer(
    React.createElement(OwnerStatementPdf, {
      statement: stmt as OwnerStatement,
      owner: owner ?? null,
      lines,
      propertyNames,
      agencyName: brand.displayName,
      branding: brand.branding,
      secondaryColor: brand.secondaryColor,
      periodLabel: monthLabel(stmt.period_year, stmt.period_month),
    }) as any
  );

  await ensureBucketExists(admin, STATEMENTS_BUCKET);
  const path = `${tenantId}/${statementId}/${stmt.period_year}-${String(stmt.period_month).padStart(2, "0")}.pdf`;
  const { error: upErr } = await admin.storage
    .from(STATEMENTS_BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);

  await admin.from("owner_statements").update({ pdf_storage_path: path }).eq("id", statementId);
  return path;
}

/**
 * Distinct (tenant, owner) pairs where the owner has ≥1 property — the cron
 * worklist.
 *
 * Tenants with the feature switched off are excluded; otherwise the job would
 * generate statements and render PDFs for agencies that cannot see them.
 * Entitlements are default-on (see src/lib/entitlements/getEntitlements.ts),
 * so only an explicit `is_enabled = false` row opts a tenant out.
 */
export async function listOwnersToGenerate(
  admin: Admin
): Promise<Array<{ tenant_id: string; owner_id: string }>> {
  const { data, error } = await admin
    .from("properties")
    .select("tenant_id, owner_landlord_id")
    .not("owner_landlord_id", "is", null);
  if (error) throw new Error(error.message);

  const { data: disabledRows, error: entErr } = await admin
    .from("tenant_feature_entitlements")
    .select("tenant_id")
    .eq("feature_key", "owner_statements")
    .eq("is_enabled", false);
  if (entErr) throw new Error(entErr.message);
  const disabled = new Set(
    ((disabledRows ?? []) as Array<{ tenant_id: string }>).map((r) => r.tenant_id)
  );

  const seen = new Set<string>();
  const out: Array<{ tenant_id: string; owner_id: string }> = [];
  for (const r of (data ?? []) as Array<{ tenant_id: string; owner_landlord_id: string }>) {
    if (disabled.has(r.tenant_id)) continue;
    const key = `${r.tenant_id}:${r.owner_landlord_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tenant_id: r.tenant_id, owner_id: r.owner_landlord_id });
  }
  return out;
}

export { STATEMENTS_BUCKET };
