import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The agency's own platform invoices.
 *
 * Read through the SSR client, NOT the admin client, so the RLS policy on
 * `tenant_platform_invoices` is what scopes the result: own tenant only, and
 * `status <> 'draft'` — a draft is our working copy and may still change.
 * Deliberately not passing a tenant_id at all; the policy decides, which means a
 * mistake here cannot leak another agency's bill.
 *
 * This closes a gap rather than adding a feature: the RLS policy has always
 * granted this read, and both the issue action and the super-admin billing
 * screen tell the operator "the agency can now see it" — but nothing ever
 * displayed it.
 */

export type MyInvoiceLine = {
  id: string;
  kind: "integration" | "envelopes" | "adjustment" | "usage";
  description: string;
  amountPence: number;
};

export type MyInvoice = {
  id: string;
  periodLabel: string;
  subtotalPence: number;
  vatPence: number;
  totalPence: number;
  status: "issued" | "paid" | "void";
  issuedAt: string | null;
  paidAt: string | null;
  lines: MyInvoiceLine[];
};

export async function getMyPlatformInvoices(): Promise<MyInvoice[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenant_platform_invoices")
    .select(
      "id, period_year, period_month, subtotal_pence, vat_pence, total_pence, status, issued_at, paid_at"
    )
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(24);

  // The table is applied by hand, so there is a window where this page is
  // deployed and it is not. An empty list is honest here — there genuinely are
  // no invoices the agency can see — and far better than a 500 on a settings
  // page. The super-admin side is the one that must shout about a missing table.
  if (error || !data) return [];

  const ids = data.map((row) => row.id as string);

  const { data: lines } = ids.length
    ? await supabase
        .from("tenant_platform_invoice_lines")
        .select("id, invoice_id, kind, description, amount_pence")
        .in("invoice_id", ids)
    : { data: [] as Record<string, unknown>[] };

  const linesByInvoice = new Map<string, MyInvoiceLine[]>();
  for (const line of lines ?? []) {
    const list = linesByInvoice.get(line.invoice_id as string) ?? [];
    list.push({
      id: line.id as string,
      kind: line.kind as MyInvoiceLine["kind"],
      description: line.description as string,
      amountPence: line.amount_pence as number,
    });
    linesByInvoice.set(line.invoice_id as string, list);
  }

  return data.map((row) => ({
    id: row.id as string,
    periodLabel: new Date(
      Date.UTC((row.period_year as number), (row.period_month as number) - 1, 1)
    ).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    subtotalPence: row.subtotal_pence as number,
    vatPence: row.vat_pence as number,
    totalPence: row.total_pence as number,
    status: row.status as MyInvoice["status"],
    issuedAt: (row.issued_at as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    lines: linesByInvoice.get(row.id as string) ?? [],
  }));
}
