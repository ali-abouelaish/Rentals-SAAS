import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getIntegration } from "@/lib/integrations/catalog";
import { getMeter } from "./meters";
import {
  billingPeriod,
  buildInvoiceLines,
  canRegenerate,
  invoiceTotals,
  VAT_RATE_BPS,
  type BillingPeriod,
  type EnvelopePurchaseInput,
  type InvoiceLineDraft,
  type PlatformChargeInput,
  type SubscriptionInput,
  type UsageInput,
} from "./rates";

export type GenerateResult = {
  period: BillingPeriod;
  created: number;
  updated: number;
  /** Agencies with nothing to bill — no invoice is raised at all. */
  skippedEmpty: number;
  /** Agencies whose invoice is already issued or paid and was left alone. */
  skippedLocked: number;
  totalPence: number;
  errors: { tenantId: string; error: string }[];
};

/**
 * Build draft invoices for a period.
 *
 * Safe to run repeatedly. A tenant's existing DRAFT is rebuilt from source; an
 * issued or paid invoice is left untouched and counted in `skippedLocked`.
 * That is what lets the monthly cron and the admin button share one code path
 * without either being able to rewrite a bill somebody has already received.
 *
 * Nothing is ever sent to an agency here. Generation produces drafts; issuing
 * is a separate, deliberate action.
 */
export async function generatePlatformInvoices(
  period: BillingPeriod
): Promise<GenerateResult> {
  const admin = createSupabaseAdminClient();

  const result: GenerateResult = {
    period,
    created: 0,
    updated: 0,
    skippedEmpty: 0,
    skippedLocked: 0,
    totalPence: 0,
    errors: [],
  };

  // Usage is metered in ARREARS while subscriptions bill in advance, so the
  // October invoice carries October's subscriptions and September's usage. The
  // counters to read are therefore the previous month's, not this period's.
  const usagePeriod =
    period.month === 1
      ? billingPeriod(period.year - 1, 12)
      : billingPeriod(period.year, period.month - 1);

  const [
    { data: tenants, error: tenantsError },
    { data: subscriptions },
    { data: purchases },
    { data: usageCounters },
    { data: charges },
    { data: existing },
  ] = await Promise.all([
    admin.from("tenants").select("id, name").order("name", { ascending: true }),
    admin
      .from("tenant_integration_subscriptions")
      .select(
        "tenant_id, integration_key, status, monthly_price_pence, is_grandfathered, billing_starts_on, ends_on"
      ),
    // Only purchases belonging to this period and not already billed. A
    // purchase already carrying an invoice_id must not be picked up again —
    // that would bill it twice across two months.
    admin
      .from("tenant_envelope_purchases")
      .select("id, tenant_id, envelopes, price_pence, billing_period, invoiced_at")
      .eq("billing_period", period.start)
      .is("invoiced_at", null),
    // Only counters with something chargeable on them. Every meter's rate is
    // zero today, so this normally returns nothing and invoices are unchanged.
    admin
      .from("tenant_usage_counters")
      .select("id, tenant_id, meter_key, quantity, billable, unit_price_pence, amount_pence, period_start")
      .eq("period_start", usagePeriod.start)
      .gt("amount_pence", 0),
    // Agreed charges — the base fee and anything negotiated. Filtered to the
    // period in code by chargeBillable rather than in SQL: the window rule has
    // to match subscriptions exactly, and expressing it once keeps the two from
    // drifting apart.
    admin
      .from("tenant_platform_charges")
      .select("id, tenant_id, label, amount_pence, billing_starts_on, ends_on"),
    // Void invoices are invisible here. They are superseded records, and the
    // partial unique index deliberately allows a replacement — so a voided
    // month regenerates cleanly and its released purchases land on the new
    // invoice.
    admin
      .from("tenant_platform_invoices")
      .select("id, tenant_id, status")
      .eq("period_year", period.year)
      .eq("period_month", period.month)
      .neq("status", "void"),
  ]);

  if (tenantsError) throw new Error(tenantsError.message);

  const subsByTenant = new Map<string, SubscriptionInput[]>();
  for (const row of subscriptions ?? []) {
    const integration = getIntegration(row.integration_key as string);
    // An integration retired from the catalogue bills nothing — there is no
    // name to put on the line and no price we still stand behind.
    if (!integration) continue;
    const list = subsByTenant.get(row.tenant_id as string) ?? [];
    list.push({
      integrationKey: row.integration_key as string,
      name: integration.name,
      status: row.status as string,
      monthlyPricePence: row.monthly_price_pence as number,
      isGrandfathered: row.is_grandfathered as boolean,
      billingStartsOn: (row.billing_starts_on as string | null) ?? null,
      endsOn: (row.ends_on as string | null) ?? null,
    });
    subsByTenant.set(row.tenant_id as string, list);
  }

  const purchasesByTenant = new Map<string, EnvelopePurchaseInput[]>();
  for (const row of purchases ?? []) {
    const list = purchasesByTenant.get(row.tenant_id as string) ?? [];
    list.push({
      id: row.id as string,
      envelopes: row.envelopes as number,
      pricePence: row.price_pence as number,
      billingPeriod: row.billing_period as string,
    });
    purchasesByTenant.set(row.tenant_id as string, list);
  }

  const usageByTenant = new Map<string, UsageInput[]>();
  for (const row of usageCounters ?? []) {
    const meter = getMeter(row.meter_key as string);
    // A meter retired from the catalogue bills nothing — same rule as a retired
    // integration: no name for the line, and no rate we still stand behind.
    if (!meter) continue;
    const list = usageByTenant.get(row.tenant_id as string) ?? [];
    list.push({
      id: row.id as string,
      meterKey: row.meter_key as string,
      name: meter.name,
      quantity: row.quantity as number,
      billable: row.billable as number,
      // Read from the counter, not the catalogue: these were frozen at rollup.
      unitPricePence: row.unit_price_pence as number,
      amountPence: row.amount_pence as number,
      periodStart: row.period_start as string,
    });
    usageByTenant.set(row.tenant_id as string, list);
  }

  const chargesByTenant = new Map<string, PlatformChargeInput[]>();
  for (const row of charges ?? []) {
    const list = chargesByTenant.get(row.tenant_id as string) ?? [];
    list.push({
      id: row.id as string,
      label: row.label as string,
      amountPence: row.amount_pence as number,
      billingStartsOn: row.billing_starts_on as string,
      endsOn: (row.ends_on as string | null) ?? null,
    });
    chargesByTenant.set(row.tenant_id as string, list);
  }

  const existingByTenant = new Map(
    (existing ?? []).map((row) => [
      row.tenant_id as string,
      { id: row.id as string, status: row.status as string },
    ])
  );

  for (const tenant of tenants ?? []) {
    const tenantId = tenant.id as string;
    const prior = existingByTenant.get(tenantId);

    if (prior && !canRegenerate(prior.status)) {
      result.skippedLocked += 1;
      continue;
    }

    const tenantPurchases = purchasesByTenant.get(tenantId) ?? [];
    const lines = buildInvoiceLines({
      subscriptions: subsByTenant.get(tenantId) ?? [],
      purchases: tenantPurchases,
      usage: usageByTenant.get(tenantId) ?? [],
      charges: chargesByTenant.get(tenantId) ?? [],
      period,
    });

    if (lines.length === 0) {
      // No empty invoices. A £0 bill is noise for the agency and clutter in
      // the list, and its absence is not ambiguous — nothing was owed.
      result.skippedEmpty += 1;
      continue;
    }

    const totals = invoiceTotals(lines, VAT_RATE_BPS);

    try {
      const invoiceId = await upsertInvoice({
        tenantId,
        period,
        totals,
        lines,
        existingId: prior?.id ?? null,
      });

      // Claim the purchases for this invoice. Done after the invoice exists so
      // a failure leaves them unbilled and pickable by the next run — the safe
      // direction, since the alternative is a purchase marked billed that
      // appears on no invoice.
      const billedPurchaseIds = lines
        .filter((line) => line.sourceKind === "envelope_purchase")
        .map((line) => line.sourceRef!)
        .filter(Boolean);

      if (billedPurchaseIds.length > 0) {
        const { error: claimError } = await admin
          .from("tenant_envelope_purchases")
          .update({ invoiced_at: new Date().toISOString(), invoice_id: invoiceId })
          .in("id", billedPurchaseIds);

        if (claimError) {
          console.error("[billing] invoice raised but purchases not marked billed", {
            tenantId,
            invoiceId,
            error: claimError.message,
          });
        }
      }

      if (prior) result.updated += 1;
      else result.created += 1;
      result.totalPence += totals.totalPence;
    } catch (err) {
      result.errors.push({
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

async function upsertInvoice(input: {
  tenantId: string;
  period: BillingPeriod;
  totals: ReturnType<typeof invoiceTotals>;
  lines: InvoiceLineDraft[];
  existingId: string | null;
}): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { tenantId, period, totals, lines, existingId } = input;

  const values = {
    tenant_id: tenantId,
    period_year: period.year,
    period_month: period.month,
    period_start: period.start,
    period_end: period.end,
    subtotal_pence: totals.subtotalPence,
    vat_rate_bps: totals.vatRateBps,
    vat_pence: totals.vatPence,
    total_pence: totals.totalPence,
    status: "draft" as const,
    generated_at: new Date().toISOString(),
  };

  let invoiceId: string;

  if (existingId) {
    const { error } = await admin
      .from("tenant_platform_invoices")
      .update(values)
      .eq("id", existingId)
      // Re-asserted in the statement, not just checked above: between the read
      // and this write someone could have issued it from the admin screen, and
      // the whole point is that an issued invoice is never rewritten.
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    invoiceId = existingId;

    // Rebuild the lines rather than diffing them. They are wholly derived from
    // the subscriptions and purchases, so a rebuild is the same result with far
    // less that can go subtly wrong.
    const { error: clearError } = await admin
      .from("tenant_platform_invoice_lines")
      .delete()
      .eq("invoice_id", invoiceId);
    if (clearError) throw new Error(clearError.message);

    // Any purchase previously billed on this draft goes back in the pool, so a
    // rebuild that no longer includes it doesn't strand it as billed-but-absent.
    await admin
      .from("tenant_envelope_purchases")
      .update({ invoiced_at: null, invoice_id: null })
      .eq("invoice_id", invoiceId);
  } else {
    const { data, error } = await admin
      .from("tenant_platform_invoices")
      .insert(values)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not create the invoice.");
    invoiceId = data.id as string;
  }

  const { error: linesError } = await admin.from("tenant_platform_invoice_lines").insert(
    lines.map((line) => ({
      invoice_id: invoiceId,
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit_price_pence: line.unitPricePence,
      amount_pence: line.amountPence,
      source_kind: line.sourceKind ?? null,
      source_ref: line.sourceRef ?? null,
    }))
  );
  if (linesError) throw new Error(linesError.message);

  return invoiceId;
}
