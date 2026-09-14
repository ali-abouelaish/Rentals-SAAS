import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { getIntegration } from "@/lib/integrations/catalog";
import {
  currentBillingPeriod,
  subscriptionBillable,
  type SubscriptionInput
} from "@/lib/billing/rates";

/**
 * The money and attention roll-up for /admin.
 *
 * `getAdminOverviewStats` in ./admin.ts still owns the estate counts (tenants,
 * users, access profiles). This module adds what the platform is earning and
 * what is waiting on a human — none of which was visible anywhere.
 */

export type RevenueSummary = {
  /** Monthly recurring revenue from active, billable integration subscriptions. */
  mrrPence: number;
  subscriptionCount: number;
  /** This month's invoices. Void excluded throughout — it is not money owed. */
  draftPence: number;
  issuedPence: number;
  paidPence: number;
  /** Issued and unpaid, regardless of age. */
  outstandingPence: number;
  /** Issued, unpaid, and more than 30 days old. */
  overduePence: number;
  overdueCount: number;
  draftCount: number;
  /** Envelope purchases not yet on any invoice. */
  unbilledEnvelopePence: number;
  unbilledEnvelopeCount: number;
};

export type AttentionItem = {
  key: string;
  label: string;
  detail: string;
  count: number;
  href: string;
  severity: "info" | "warning";
};

export type AdminOverview = {
  revenue: RevenueSummary;
  attention: AttentionItem[];
  /** Tables that could not be read — migrations are applied by hand here. */
  unavailable: string[];
};

const OVERDUE_AFTER_DAYS = 30;

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const period = currentBillingPeriod();
  const unavailable: string[] = [];

  const overdueCutoff = new Date(
    Date.now() - OVERDUE_AFTER_DAYS * 86_400_000
  ).toISOString();

  const [subscriptions, invoices, envelopes, mailboxes, brands] = await Promise.all([
    admin
      .from("tenant_integration_subscriptions")
      .select(
        "tenant_id, integration_key, status, monthly_price_pence, is_grandfathered, billing_starts_on, ends_on"
      ),
    admin
      .from("tenant_platform_invoices")
      .select("id, tenant_id, status, total_pence, issued_at, period_year, period_month"),
    admin
      .from("tenant_envelope_purchases")
      .select("id, price_pence")
      .is("invoiced_at", null),
    admin
      .from("email_providers")
      .select("tenant_id, status")
      .in("status", ["error", "disabled"]),
    // `sender_identity_verified_at`, not a `status` column — there isn't one.
    // BoldSign's own status strings are undocumented and mapped defensively at
    // read time (see 20260912000001), so the timestamp is the only reliable
    // signal that an identity is actually usable.
    admin
      .from("boldsign_agency_brands")
      .select("tenant_id, sender_identity_verified_at, sender_identity_status")
  ]);

  // ---------------------------------------------------------
  // MRR
  // ---------------------------------------------------------
  // Uses subscriptionBillable(), the same predicate the invoice run uses. Any
  // other rule here — "status = active", say — would eventually disagree with
  // what is actually billed, and a revenue figure that disagrees with the
  // invoices is worse than none.
  let mrrPence = 0;
  let subscriptionCount = 0;

  if (subscriptions.error) {
    unavailable.push("tenant_integration_subscriptions");
  } else {
    for (const row of subscriptions.data ?? []) {
      const integration = getIntegration(row.integration_key as string);
      if (!integration) continue;

      const input: SubscriptionInput = {
        integrationKey: row.integration_key as string,
        name: integration.name,
        status: row.status as string,
        monthlyPricePence: row.monthly_price_pence as number,
        isGrandfathered: row.is_grandfathered as boolean,
        billingStartsOn: (row.billing_starts_on as string | null) ?? null,
        endsOn: (row.ends_on as string | null) ?? null
      };

      if (subscriptionBillable(input, period)) {
        mrrPence += input.monthlyPricePence;
        subscriptionCount += 1;
      }
    }
  }

  // ---------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------
  let draftPence = 0;
  let issuedPence = 0;
  let paidPence = 0;
  let overduePence = 0;
  let overdueCount = 0;
  let draftCount = 0;

  if (invoices.error) {
    unavailable.push("tenant_platform_invoices");
  } else {
    for (const row of invoices.data ?? []) {
      const total = (row.total_pence as number) ?? 0;
      const status = row.status as string;

      // Draft and paid totals are scoped to the CURRENT month — they describe
      // this billing cycle. Outstanding and overdue deliberately are not: money
      // owed from August is still owed in September, and scoping arrears to the
      // current month would hide exactly the debt worth chasing.
      const isCurrentPeriod =
        row.period_year === period.year && row.period_month === period.month;

      if (status === "draft") {
        if (isCurrentPeriod) {
          draftPence += total;
          draftCount += 1;
        }
      } else if (status === "issued") {
        issuedPence += total;
        if (row.issued_at && (row.issued_at as string) < overdueCutoff) {
          overduePence += total;
          overdueCount += 1;
        }
      } else if (status === "paid" && isCurrentPeriod) {
        paidPence += total;
      }
    }
  }

  let unbilledEnvelopePence = 0;
  let unbilledEnvelopeCount = 0;
  if (envelopes.error) {
    unavailable.push("tenant_envelope_purchases");
  } else {
    for (const row of envelopes.data ?? []) {
      unbilledEnvelopePence += (row.price_pence as number) ?? 0;
      unbilledEnvelopeCount += 1;
    }
  }

  const revenue: RevenueSummary = {
    mrrPence,
    subscriptionCount,
    draftPence,
    issuedPence,
    paidPence,
    // Everything issued and not yet paid, of any age.
    outstandingPence: issuedPence,
    overduePence,
    overdueCount,
    draftCount,
    unbilledEnvelopePence,
    unbilledEnvelopeCount
  };

  // ---------------------------------------------------------
  // Needs attention
  // ---------------------------------------------------------
  const attention: AttentionItem[] = [];

  if (draftCount > 0) {
    attention.push({
      key: "drafts",
      label: "Draft invoices awaiting issue",
      detail: "Generated but not yet sent to the agency.",
      count: draftCount,
      href: "/admin/billing",
      severity: "info"
    });
  }

  if (overdueCount > 0) {
    attention.push({
      key: "overdue",
      label: `Invoices unpaid over ${OVERDUE_AFTER_DAYS} days`,
      detail: "Issued and still not marked paid.",
      count: overdueCount,
      href: "/admin/billing",
      severity: "warning"
    });
  }

  // Subscriptions waiting on US. TDS and DPS issue credentials per agency and
  // applying them is a requireSuperAdmin action, so the agency cannot clear this
  // themselves — they are paying for an integration that does nothing until
  // somebody here configures it. Nothing surfaced this before.
  if (!subscriptions.error) {
    const blockedOnUs = (subscriptions.data ?? []).filter((row) => {
      if (row.status !== "pending_setup") return false;
      const integration = getIntegration(row.integration_key as string);
      return integration?.setupOwner === "harbor_ops";
    });

    if (blockedOnUs.length > 0) {
      attention.push({
        key: "blocked_on_us",
        label: "Integrations waiting on us to configure",
        detail: "TDS/DPS credentials the agency cannot apply themselves.",
        count: blockedOnUs.length,
        href: "/admin/deposit-schemes",
        severity: "warning"
      });
    }
  }

  if (!mailboxes.error && (mailboxes.data ?? []).length > 0) {
    attention.push({
      key: "mailboxes",
      label: "Agency mailboxes failing",
      detail: "Their own email provider is in error or disabled.",
      count: (mailboxes.data ?? []).length,
      href: "/admin/health",
      severity: "warning"
    });
  }

  // E-signing subscribers with no verified sender identity. Not blocking — those
  // agencies still send, under the default Harbor Ops identity — so this is
  // informational. It matters because a paying agency's contracts are going out
  // under our name rather than theirs, which they will eventually ask about.
  if (!subscriptions.error && !brands.error) {
    const verifiedTenants = new Set(
      (brands.data ?? [])
        .filter((row) => Boolean(row.sender_identity_verified_at))
        .map((row) => row.tenant_id as string)
    );

    const esigningWithoutIdentity = (subscriptions.data ?? []).filter(
      (row) =>
        row.integration_key === "e_signing" &&
        row.status === "active" &&
        !verifiedTenants.has(row.tenant_id as string)
    );

    if (esigningWithoutIdentity.length > 0) {
      attention.push({
        key: "esigning_identity",
        label: "E-signing without a verified sender",
        detail: "Sending under the default Harbor Ops identity, not their own.",
        count: esigningWithoutIdentity.length,
        href: "/admin/e-signing",
        severity: "info"
      });
    }
  }

  return { revenue, attention, unavailable: Array.from(new Set(unavailable)) };
}
