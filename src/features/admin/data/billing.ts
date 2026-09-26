import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { getIntegration } from "@/lib/integrations/catalog";
import { getMeter } from "@/lib/billing/meters";
import type { BillingPeriod } from "@/lib/billing/rates";

export type PlatformInvoiceLine = {
  id: string;
  // 'usage' was added to the table's CHECK by 20260913000004_usage_metering.sql
  // and to InvoiceLineDraft in lib/billing/rates.ts, but missed here — so a
  // metered overage line read back was typed as something it is not.
  kind: "integration" | "envelopes" | "adjustment" | "usage" | "plan";
  description: string;
  quantity: number;
  unit_price_pence: number;
  amount_pence: number;
};

export type PlatformInvoiceRow = {
  id: string;
  tenant: { id: string; name: string };
  invoice_number: string | null;
  period_start: string;
  period_end: string;
  subtotal_pence: number;
  vat_pence: number;
  total_pence: number;
  status: "draft" | "issued" | "paid" | "void";
  issued_at: string | null;
  paid_at: string | null;
  generated_at: string;
  /** When the invoice was emailed, and to where. Null until it is sent. */
  emailed_at: string | null;
  emailed_to: string | null;
  /** Last send failure. Surfaced so a failed send isn't mistaken for a sent one. */
  email_error: string | null;
  /** The agency's billing contact, to pre-fill the send dialog. */
  billing_email: string | null;
  lines: PlatformInvoiceLine[];
};

export type PlatformBillingSummary = {
  invoices: PlatformInvoiceRow[];
  /** Excludes void — a cancelled invoice is not money anybody owes. */
  draftTotalPence: number;
  issuedTotalPence: number;
  paidTotalPence: number;
  /**
   * The invoice tables could not be read.
   *
   * Migrations are applied by hand in this project, so this is an expected
   * transient state — but it must not render as "nothing to bill". An empty
   * month and a missing table look identical otherwise, and the difference is
   * whether anybody gets invoiced.
   */
  unavailable: boolean;
  error: string | null;
};

/**
 * Every invoice for a period, with its lines.
 *
 * Lines are fetched in one query and grouped in memory rather than joined per
 * invoice: a month is tens of invoices with a handful of lines each, so two
 * round trips beat N+1 by a wide margin and the grouping is trivial.
 */
export async function getPlatformInvoices(
  period: BillingPeriod
): Promise<PlatformBillingSummary> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: invoices, error } = await admin
    .from("tenant_platform_invoices")
    .select(
      "id, tenant_id, invoice_number, period_start, period_end, subtotal_pence, vat_pence, total_pence, status, issued_at, paid_at, generated_at, emailed_at, emailed_to, email_error, tenants(id, name)"
    )
    .eq("period_year", period.year)
    .eq("period_month", period.month)
    .order("total_pence", { ascending: false });

  // The tables are applied by hand, so don't break the page before the migration
  // lands — but say so rather than implying there is nothing to bill.
  if (error) {
    return {
      invoices: [],
      draftTotalPence: 0,
      issuedTotalPence: 0,
      paidTotalPence: 0,
      unavailable: true,
      error: error.message
    };
  }

  const ids = (invoices ?? []).map((row) => row.id as string);

  const { data: lines } = ids.length
    ? await admin
        .from("tenant_platform_invoice_lines")
        .select("id, invoice_id, kind, description, quantity, unit_price_pence, amount_pence")
        .in("invoice_id", ids)
    : { data: [] as Record<string, unknown>[] };

  // Billing contacts for every agency on this page, in one query. Needed to
  // pre-fill the send dialog; fetching per invoice would be N+1 for a value
  // that is the same for every invoice a tenant has.
  const tenantIds = Array.from(
    new Set((invoices ?? []).map((row) => row.tenant_id as string))
  );
  const { data: billingRows } = tenantIds.length
    ? await admin
        .from("tenant_billing_info")
        .select("tenant_id, billing_email")
        .in("tenant_id", tenantIds)
    : { data: [] as Record<string, unknown>[] };

  const billingByTenant = new Map(
    (billingRows ?? []).map((row) => [
      row.tenant_id as string,
      (row.billing_email as string | null) ?? null,
    ])
  );

  const linesByInvoice = new Map<string, PlatformInvoiceLine[]>();
  for (const line of lines ?? []) {
    const list = linesByInvoice.get(line.invoice_id as string) ?? [];
    list.push({
      id: line.id as string,
      kind: line.kind as PlatformInvoiceLine["kind"],
      description: line.description as string,
      quantity: line.quantity as number,
      unit_price_pence: line.unit_price_pence as number,
      amount_pence: line.amount_pence as number,
    });
    linesByInvoice.set(line.invoice_id as string, list);
  }

  const rows: PlatformInvoiceRow[] = (invoices ?? []).map((row) => {
    // The embedded relation comes back as an object or a single-element array
    // depending on how PostgREST infers the relationship.
    const embedded = row.tenants as { id: string; name: string } | { id: string; name: string }[] | null;
    const tenant = Array.isArray(embedded) ? embedded[0] : embedded;

    return {
      id: row.id as string,
      tenant: {
        id: tenant?.id ?? (row.tenant_id as string),
        name: tenant?.name ?? "Unknown agency",
      },
      invoice_number: (row.invoice_number as string | null) ?? null,
      emailed_at: (row.emailed_at as string | null) ?? null,
      emailed_to: (row.emailed_to as string | null) ?? null,
      email_error: (row.email_error as string | null) ?? null,
      billing_email: billingByTenant.get(row.tenant_id as string) ?? null,
      period_start: row.period_start as string,
      period_end: row.period_end as string,
      subtotal_pence: row.subtotal_pence as number,
      vat_pence: row.vat_pence as number,
      total_pence: row.total_pence as number,
      status: row.status as PlatformInvoiceRow["status"],
      issued_at: (row.issued_at as string | null) ?? null,
      paid_at: (row.paid_at as string | null) ?? null,
      generated_at: row.generated_at as string,
      lines: linesByInvoice.get(row.id as string) ?? [],
    };
  });

  const sumWhere = (status: PlatformInvoiceRow["status"]) =>
    rows.filter((row) => row.status === status).reduce((sum, row) => sum + row.total_pence, 0);

  return {
    invoices: rows,
    draftTotalPence: sumWhere("draft"),
    issuedTotalPence: sumWhere("issued"),
    paidTotalPence: sumWhere("paid"),
    unavailable: false,
    error: null,
  };
}

// ============================================================
// Per-agency billing history
// ============================================================

export type AgencyInvoiceRow = {
  id: string;
  period_year: number;
  period_month: number;
  period_label: string;
  subtotal_pence: number;
  vat_pence: number;
  total_pence: number;
  status: "draft" | "issued" | "paid" | "void";
  issued_at: string | null;
  paid_at: string | null;
  lines: PlatformInvoiceLine[];
};

export type AgencyChargeRow = {
  id: string;
  label: string;
  amountPence: number;
  billingStartsOn: string;
  endsOn: string | null;
  notes: string | null;
  /** Whether it applies to the current month. */
  isLive: boolean;
};

export type AgencySubscriptionRow = {
  integrationKey: string;
  name: string;
  status: string;
  monthlyPricePence: number;
  isGrandfathered: boolean;
  billingStartsOn: string | null;
  endsOn: string | null;
  /** True when setup is ours to perform — TDS/DPS credentials. */
  blockedOnUs: boolean;
};

export type AgencyUsageRow = {
  periodStart: string;
  meterKey: string;
  name: string;
  unit: string;
  quantity: number;
  included: number;
  billable: number;
  amountPence: number;
};

export type AgencyEnvelopePurchaseRow = {
  id: string;
  envelopes: number;
  pricePence: number;
  billingPeriod: string;
  purchasedAt: string;
  invoicedAt: string | null;
};

export type AgencyBillingHistory = {
  invoices: AgencyInvoiceRow[];
  /** What we agreed this agency pays: base fee, custom lines, discounts. */
  charges: AgencyChargeRow[];
  subscriptions: AgencySubscriptionRow[];
  usage: AgencyUsageRow[];
  purchases: AgencyEnvelopePurchaseRow[];
  lifetimePaidPence: number;
  outstandingPence: number;
  /** Current monthly recurring revenue from this agency. */
  mrrPence: number;
  unavailable: string[];
};

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Everything billing-related for one agency.
 *
 * The month view at /admin/billing answers "who owes us what this month". This
 * answers "what is the story with this agency", which is where an actual billing
 * conversation starts.
 */
export async function getAgencyBillingHistory(
  tenantId: string
): Promise<AgencyBillingHistory> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const unavailable: string[] = [];

  const [
    invoicesResult,
    chargesResult,
    subscriptionsResult,
    usageResult,
    purchasesResult
  ] = await Promise.all([
      admin
        .from("tenant_platform_invoices")
        .select(
          "id, period_year, period_month, subtotal_pence, vat_pence, total_pence, status, issued_at, paid_at"
        )
        .eq("tenant_id", tenantId)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false }),
      admin
        .from("tenant_platform_charges")
        .select("id, label, amount_pence, billing_starts_on, ends_on, notes")
        .eq("tenant_id", tenantId)
        .order("billing_starts_on", { ascending: false }),
      admin
        .from("tenant_integration_subscriptions")
        .select(
          "integration_key, status, monthly_price_pence, is_grandfathered, billing_starts_on, ends_on"
        )
        .eq("tenant_id", tenantId),
      admin
        .from("tenant_usage_counters")
        .select("period_start, meter_key, quantity, included, billable, amount_pence")
        .eq("tenant_id", tenantId)
        .order("period_start", { ascending: false })
        .limit(200),
      admin
        .from("tenant_envelope_purchases")
        .select("id, envelopes, price_pence, billing_period, purchased_at, invoiced_at")
        .eq("tenant_id", tenantId)
        .order("purchased_at", { ascending: false }),
    ]);

  if (invoicesResult.error) unavailable.push("tenant_platform_invoices");
  if (chargesResult.error) unavailable.push("tenant_platform_charges");
  if (subscriptionsResult.error) unavailable.push("tenant_integration_subscriptions");
  if (usageResult.error) unavailable.push("tenant_usage_counters");
  if (purchasesResult.error) unavailable.push("tenant_envelope_purchases");

  // Lines for every invoice in one query, grouped in memory — same reasoning as
  // getPlatformInvoices above.
  const invoiceIds = (invoicesResult.data ?? []).map((row) => row.id as string);
  const { data: lines } = invoiceIds.length
    ? await admin
        .from("tenant_platform_invoice_lines")
        .select("id, invoice_id, kind, description, quantity, unit_price_pence, amount_pence")
        .in("invoice_id", invoiceIds)
    : { data: [] as Record<string, unknown>[] };

  const linesByInvoice = new Map<string, PlatformInvoiceLine[]>();
  for (const line of lines ?? []) {
    const list = linesByInvoice.get(line.invoice_id as string) ?? [];
    list.push({
      id: line.id as string,
      kind: line.kind as PlatformInvoiceLine["kind"],
      description: line.description as string,
      quantity: line.quantity as number,
      unit_price_pence: line.unit_price_pence as number,
      amount_pence: line.amount_pence as number,
    });
    linesByInvoice.set(line.invoice_id as string, list);
  }

  const invoices: AgencyInvoiceRow[] = (invoicesResult.data ?? []).map((row) => ({
    id: row.id as string,
    period_year: row.period_year as number,
    period_month: row.period_month as number,
    period_label: monthLabel(row.period_year as number, row.period_month as number),
    subtotal_pence: row.subtotal_pence as number,
    vat_pence: row.vat_pence as number,
    total_pence: row.total_pence as number,
    status: row.status as AgencyInvoiceRow["status"],
    issued_at: (row.issued_at as string | null) ?? null,
    paid_at: (row.paid_at as string | null) ?? null,
    lines: linesByInvoice.get(row.id as string) ?? [],
  }));

  // "Live" means it applies to the month we are in now: started, not ended.
  // Plain ISO string comparison, the same rule chargeBillable uses at invoice
  // time, so the badge here and the invoice line cannot disagree.
  const todayIso = new Date().toISOString().slice(0, 10);

  const charges: AgencyChargeRow[] = (chargesResult.data ?? []).map((row) => {
    const startsOn = row.billing_starts_on as string;
    const endsOn = (row.ends_on as string | null) ?? null;
    return {
      id: row.id as string,
      label: row.label as string,
      amountPence: row.amount_pence as number,
      billingStartsOn: startsOn,
      endsOn,
      notes: (row.notes as string | null) ?? null,
      isLive: startsOn <= todayIso && (!endsOn || endsOn >= todayIso)
    };
  });

  const subscriptions: AgencySubscriptionRow[] = (subscriptionsResult.data ?? [])
    .map((row) => {
      const integration = getIntegration(row.integration_key as string);
      return {
        integrationKey: row.integration_key as string,
        // A retired catalogue entry still shows, under its raw key — hiding a
        // subscription an agency is on would make its charges unexplainable.
        name: integration?.name ?? (row.integration_key as string),
        status: row.status as string,
        monthlyPricePence: row.monthly_price_pence as number,
        isGrandfathered: row.is_grandfathered as boolean,
        billingStartsOn: (row.billing_starts_on as string | null) ?? null,
        endsOn: (row.ends_on as string | null) ?? null,
        blockedOnUs:
          row.status === "pending_setup" && integration?.setupOwner === "harbor_ops",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const usage: AgencyUsageRow[] = (usageResult.data ?? []).map((row) => {
    const meter = getMeter(row.meter_key as string);
    return {
      periodStart: row.period_start as string,
      meterKey: row.meter_key as string,
      name: meter?.name ?? (row.meter_key as string),
      unit: meter?.unit ?? "unit",
      quantity: row.quantity as number,
      included: row.included as number,
      billable: row.billable as number,
      amountPence: row.amount_pence as number,
    };
  });

  const purchases: AgencyEnvelopePurchaseRow[] = (purchasesResult.data ?? []).map(
    (row) => ({
      id: row.id as string,
      envelopes: row.envelopes as number,
      pricePence: row.price_pence as number,
      billingPeriod: row.billing_period as string,
      purchasedAt: row.purchased_at as string,
      invoicedAt: (row.invoiced_at as string | null) ?? null,
    })
  );

  const lifetimePaidPence = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.total_pence, 0);

  const outstandingPence = invoices
    .filter((invoice) => invoice.status === "issued")
    .reduce((sum, invoice) => sum + invoice.total_pence, 0);

  // A plain sum of active priced subscriptions rather than subscriptionBillable():
  // this page shows the subscription list right beside the figure, with each row's
  // status and billing start visible, so the number the reader can verify by eye is
  // the right one to show. The platform-wide MRR on /admin uses the strict
  // predicate, because there it has to agree with what actually gets invoiced.
  // Agreed charges FIRST — for most agencies the base fee is the whole
  // relationship and the add-ons are the rounding. Discounts are negative and so
  // subtract naturally. Ended or not-yet-started charges are excluded.
  const chargeMrrPence = charges
    .filter((charge) => charge.isLive)
    .reduce((sum, charge) => sum + charge.amountPence, 0);

  const mrrPence =
    chargeMrrPence +
    subscriptions
      .filter((sub) => sub.status === "active" && !sub.isGrandfathered)
      .reduce((sum, sub) => sum + sub.monthlyPricePence, 0);

  return {
    invoices,
    charges,
    subscriptions,
    usage,
    purchases,
    lifetimePaidPence,
    outstandingPence,
    mrrPence,
    unavailable: Array.from(new Set(unavailable)),
  };
}
