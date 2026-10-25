import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAgency } from "./agency-context";
import { sendAgencyEmail } from "./agency-send";
import { loadAgencyContactEmail, MissingContactEmailError } from "./contact";
import { getTenantAppUrl } from "./app-url";
import { button, facts, harborEmail } from "./harbor";

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

type SummaryRow = readonly [label: string, value: string];

function renderHtml(title: string, rows: SummaryRow[], ctaUrl: string, ctaLabel: string): string {
  return harborEmail({
    title,
    preheader: rows.map(([, value]) => value).filter((v) => v !== "—").slice(0, 2).join(" · "),
    eyebrow: "Your workspace",
    headline: [`${title}.`, "Here are the details."],
    html: facts(rows) + button(ctaUrl, ctaLabel),
    footnote:
      "You’re receiving this because this address is set as your agency contact email. To change it, open Settings › Billing info.",
  });
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
      .select("id, tenant_id, code, consultation_fee_amount, payment_method, client_snapshot, assisted_by_agent_id")
      .eq("id", rentalId)
      .maybeSingle();
    if (!rental) return;

    const snapshot = (rental.client_snapshot ?? {}) as Record<string, unknown>;
    const clientName = (snapshot.full_name as string | undefined) ?? "—";

    const [{ data: assistedAgent }, { data: marketingAgents }] = await Promise.all([
      admin
        .from("user_profiles")
        .select("display_name")
        .eq("id", rental.assisted_by_agent_id)
        .maybeSingle(),
      admin
        .from("rental_marketing_agents")
        .select("user_profiles(display_name)")
        .eq("rental_id", rental.id),
    ]);

    const marketingNames = (marketingAgents ?? [])
      .map((row) => {
        const up = (row as { user_profiles?: { display_name?: string } | { display_name?: string }[] | null }).user_profiles;
        return Array.isArray(up) ? up[0]?.display_name : up?.display_name;
      })
      .filter((n): n is string => Boolean(n));

    const rows: SummaryRow[] = [
      ["Rental code", rental.code ?? "—"],
      ["Client", clientName],
      ["Agent assisted", assistedAgent?.display_name ?? "—"],
      ["Marketing agent", marketingNames.length ? marketingNames.join(", ") : "—"],
      ["Consultation fee", fmtMoney(rental.consultation_fee_amount)],
      ["Payment method", String(rental.payment_method ?? "—")],
    ];
    const url = await getTenantAppUrl(rental.tenant_id, `/rentals/${rental.id}`);
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
      .select("id, tenant_id, code, client_name, property_address, amount_owed, bonus_date, agent_id, landlords(name)")
      .eq("id", bonusId)
      .maybeSingle();
    if (!bonus) return;

    const landlord = bonus.landlords as { name?: string } | { name?: string }[] | null;
    const landlordName = Array.isArray(landlord) ? landlord[0]?.name : landlord?.name;

    const { data: agent } = await admin
      .from("user_profiles")
      .select("display_name")
      .eq("id", bonus.agent_id)
      .maybeSingle();

    const rows: SummaryRow[] = [
      ["Bonus code", bonus.code ?? "—"],
      ["Landlord", landlordName ?? "—"],
      ["Agent", agent?.display_name ?? "—"],
      ["Client", bonus.client_name ?? "—"],
      ["Property", bonus.property_address ?? "—"],
      ["Amount", fmtMoney(bonus.amount_owed)],
      ["Bonus date", fmtDate(bonus.bonus_date)],
    ];
    const url = await getTenantAppUrl(bonus.tenant_id, `/bonuses/${bonus.id}`);
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
      .select("id, tenant_id, invoice_number, issue_date, due_date, total, balance_due, created_by_user_id, landlords(name)")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) return;

    const landlord = invoice.landlords as { name?: string } | { name?: string }[] | null;
    const landlordName = Array.isArray(landlord) ? landlord[0]?.name : landlord?.name;

    const { data: agent } = await admin
      .from("user_profiles")
      .select("display_name")
      .eq("id", invoice.created_by_user_id)
      .maybeSingle();

    const rows: SummaryRow[] = [
      ["Invoice number", invoice.invoice_number ?? "—"],
      ["Landlord", landlordName ?? "—"],
      ["Agent", agent?.display_name ?? "—"],
      ["Issue date", fmtDate(invoice.issue_date)],
      ["Due date", fmtDate(invoice.due_date)],
      ["Total", fmtMoney(invoice.total)],
      ["Balance due", fmtMoney(invoice.balance_due)],
    ];
    const url = await getTenantAppUrl(invoice.tenant_id, `/invoices/${invoice.id}`);
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

type PropRel = { name?: string | null } | { name?: string | null }[] | null;
type UnitRel =
  | { room_number?: string | null; unit_type?: string | null; property?: PropRel }
  | { room_number?: string | null; unit_type?: string | null; property?: PropRel }[]
  | null;

export async function notifyAgencyOfNewBooking(bookingId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: booking } = await admin
      .from("bookings")
      .select(
        "id, tenant_id, booking_reference, applicant_name, applicant_email, applicant_phone, offer_price_pcm, agent_name, source, submitted_at, unit:units(room_number, unit_type, property:properties(name))"
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;

    const unitRaw = booking.unit as UnitRel;
    const unit = Array.isArray(unitRaw) ? unitRaw[0] ?? null : unitRaw;
    const propRaw = unit?.property ?? null;
    const property = Array.isArray(propRaw) ? propRaw[0] ?? null : propRaw;
    const unitLabel = unit
      ? `${property?.name ?? "Property"} — ${
          unit.unit_type === "room" && unit.room_number ? `Room ${unit.room_number}` : unit.unit_type ?? "Unit"
        }`
      : "—";

    const rows: SummaryRow[] = [
      ["Reference", booking.booking_reference ?? "—"],
      ["Applicant", booking.applicant_name ?? "—"],
      ["Email", booking.applicant_email ?? "—"],
      ["Phone", booking.applicant_phone ?? "—"],
      ["Unit", unitLabel],
    ];
    if (booking.source === "share") {
      rows.push(["Source", booking.agent_name ? `Share link — ${booking.agent_name}` : "Share link"]);
      if (booking.offer_price_pcm != null) rows.push(["Offer (pcm)", fmtMoney(booking.offer_price_pcm)]);
    }
    rows.push(["Submitted", fmtDate(booking.submitted_at)]);

    const url = await getTenantAppUrl(booking.tenant_id, `/bookings`);
    await safelySend({
      tenantId: booking.tenant_id,
      subject: `New booking received — ${booking.booking_reference ?? "application"}`,
      html: renderHtml("New booking received", rows, url, "View bookings"),
      text: renderText("New booking received", rows, url),
    });
  } catch (err) {
    console.error("[notify-creation] notifyAgencyOfNewBooking failed", err);
  }
}
