import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAgency } from "./agency-context";
import { sendAgencyEmail } from "./agency-send";
import { loadAgencyContactEmail, MissingContactEmailError } from "./contact";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://harborops.co.uk").replace(/\/$/, "");

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

function fmtMoney(n: unknown): string {
  if (n == null || n === "") return "—";
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "—";
  return GBP.format(num);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

type SummaryRow = readonly [label: string, value: string];

function renderHtml(title: string, rows: SummaryRow[], ctaUrl: string, ctaLabel: string): string {
  const body = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 12px 6px 0;color:#666;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#111;font-size:13px;font-weight:500;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:28px 28px 8px;">
      <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 16px;color:#555;font-size:14px;">A new record was created in your agency workspace.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:8px 0 20px;">${body}</table>
      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#111;color:#fff;text-decoration:none;font-size:13px;font-weight:500;">${escapeHtml(ctaLabel)}</a>
    </td></tr>
    <tr><td style="padding:16px 28px 28px;color:#999;font-size:12px;border-top:1px solid #f0f0f0;">
      You're receiving this because this address is set as your agency contact email. To change it, open Settings &rsaquo; Billing info.
    </td></tr>
  </table>
</body></html>`;
}

function renderText(title: string, rows: SummaryRow[], ctaUrl: string): string {
  return `${title}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nView: ${ctaUrl}`;
}

async function safelySend(opts: {
  tenantId: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  try {
    const [to, agency] = await Promise.all([
      loadAgencyContactEmail(opts.tenantId),
      loadAgency(opts.tenantId),
    ]);
    if (!agency) {
      console.warn("[notify-creation] agency not found; skipping", { tenantId: opts.tenantId });
      return;
    }
    await sendAgencyEmail({
      agency,
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
  } catch (err) {
    if (err instanceof MissingContactEmailError) {
      console.warn("[notify-creation] no contact_email; skipping", { tenantId: opts.tenantId });
      return;
    }
    console.error("[notify-creation] send failed", err);
  }
}

export async function notifyAgencyOfNewRental(rentalId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: rental } = await admin
      .from("rental_codes")
      .select("id, tenant_id, code, property_address, licensor_name, consultation_fee_amount, payment_method, client_snapshot")
      .eq("id", rentalId)
      .maybeSingle();
    if (!rental) return;

    const snapshot = (rental.client_snapshot ?? {}) as Record<string, unknown>;
    const clientName = (snapshot.full_name as string | undefined) ?? "—";

    const rows: SummaryRow[] = [
      ["Rental code", rental.code ?? "—"],
      ["Client", clientName],
      ["Property", rental.property_address ?? "—"],
      ["Licensor", rental.licensor_name ?? "—"],
      ["Consultation fee", fmtMoney(rental.consultation_fee_amount)],
      ["Payment method", String(rental.payment_method ?? "—")],
    ];
    const url = `${APP_URL}/rentals/${rental.id}`;
    await safelySend({
      tenantId: rental.tenant_id,
      subject: `New rental created — ${rental.code ?? "rental"}`,
      html: renderHtml("New rental created", rows, url, "View rental"),
      text: renderText("New rental created", rows, url),
    });
  } catch (err) {
    console.error("[notify-creation] notifyAgencyOfNewRental failed", err);
  }
}

export async function notifyAgencyOfNewBonus(bonusId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: bonus } = await admin
      .from("bonuses")
      .select("id, tenant_id, code, client_name, property_address, amount_owed, bonus_date, landlords(name)")
      .eq("id", bonusId)
      .maybeSingle();
    if (!bonus) return;

    const landlord = bonus.landlords as { name?: string } | { name?: string }[] | null;
    const landlordName = Array.isArray(landlord) ? landlord[0]?.name : landlord?.name;

    const rows: SummaryRow[] = [
      ["Bonus code", bonus.code ?? "—"],
      ["Landlord", landlordName ?? "—"],
      ["Client", bonus.client_name ?? "—"],
      ["Property", bonus.property_address ?? "—"],
      ["Amount", fmtMoney(bonus.amount_owed)],
      ["Bonus date", fmtDate(bonus.bonus_date)],
    ];
    const url = `${APP_URL}/bonuses/${bonus.id}`;
    await safelySend({
      tenantId: bonus.tenant_id,
      subject: `New bonus created — ${bonus.code ?? "bonus"}`,
      html: renderHtml("New bonus created", rows, url, "View bonus"),
      text: renderText("New bonus created", rows, url),
    });
  } catch (err) {
    console.error("[notify-creation] notifyAgencyOfNewBonus failed", err);
  }
}

export async function notifyAgencyOfNewInvoice(invoiceId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: invoice } = await admin
      .from("invoices")
      .select("id, tenant_id, invoice_number, issue_date, due_date, total, balance_due, landlords(name)")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) return;

    const landlord = invoice.landlords as { name?: string } | { name?: string }[] | null;
    const landlordName = Array.isArray(landlord) ? landlord[0]?.name : landlord?.name;

    const rows: SummaryRow[] = [
      ["Invoice number", invoice.invoice_number ?? "—"],
      ["Landlord", landlordName ?? "—"],
      ["Issue date", fmtDate(invoice.issue_date)],
      ["Due date", fmtDate(invoice.due_date)],
      ["Total", fmtMoney(invoice.total)],
      ["Balance due", fmtMoney(invoice.balance_due)],
    ];
    const url = `${APP_URL}/invoices/${invoice.id}`;
    await safelySend({
      tenantId: invoice.tenant_id,
      subject: `New invoice created — ${invoice.invoice_number ?? "invoice"}`,
      html: renderHtml("New invoice created", rows, url, "View invoice"),
      text: renderText("New invoice created", rows, url),
    });
  } catch (err) {
    console.error("[notify-creation] notifyAgencyOfNewInvoice failed", err);
  }
}
