"use server";

import { randomUUID, randomInt } from "crypto";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildTenantAppUrl } from "@/lib/urls";
import { loadAgency } from "@/lib/email/agency-context";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import { generateFormLinkEmail } from "@/lib/email/templates/form-link";
import { rateLimitCheck } from "../lib/rate-limit";
import { getPublicShareByToken, getPublicShareUnits } from "../data/public";
import { deriveShareStatus, isShareUnitBookable } from "../domain/types";
import type { PropertyShare } from "../domain/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Unambiguous alphabet (no 0/O/1/I/L/U) for a short, random — not sequential —
// booking reference, mirroring features/booking-forms/actions/form-responses.ts.
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
function generateBookingReference(): string {
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `BK-${suffix}`;
}

export type ShareBookingFormOption = { id: string; name: string; public_slug: string };

export type ShareUnitBookingFormsResult =
  | {
      ok: true;
      forms: ShareBookingFormOption[];
      minPrice: number | null;
      maxPrice: number | null;
    }
  | { ok: false; error: string };

// Resolve an active share, verify the unit is one it exposes, and return the
// booking forms that apply to that unit's portfolio (portfolio-scoped or global),
// plus the unit's listed price range so the agent can propose an in-range offer.
// Mirrors the auth'd getRoomBookingLink, but scoped by the public share token.
async function resolveShareUnit(
  token: string,
  unitId: string
): Promise<
  | { ok: true; share: PropertyShare; portfolioId: string | null; minPrice: number | null; maxPrice: number | null }
  | { ok: false; error: string }
> {
  const share = await getPublicShareByToken(token);
  if (!share || deriveShareStatus(share) !== "active") {
    return { ok: false, error: "This share link is no longer active" };
  }

  const units = await getPublicShareUnits(share);
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return { ok: false, error: "Unit not found in this share" };
  if (!isShareUnitBookable(unit.status)) {
    return { ok: false, error: "Booking forms can only be sent for available or upcoming (move-out) units" };
  }

  // Portfolio drives which booking forms apply — not exposed by the public units
  // projection, so look it up directly (scoped to the share's tenant).
  const supabase = createSupabaseAdminClient();
  const { data: unitRow } = await supabase
    .from("units")
    .select("property:properties(portfolio_id)")
    .eq("id", unitId)
    .eq("tenant_id", share.tenant_id)
    .maybeSingle<{ property: { portfolio_id: string | null } | null }>();

  return {
    ok: true,
    share,
    portfolioId: unitRow?.property?.portfolio_id ?? null,
    minPrice: unit.min_price_pcm,
    maxPrice: unit.max_price_pcm,
  };
}

export async function getShareUnitBookingForms(
  token: string,
  unitId: string
): Promise<ShareUnitBookingFormsResult> {
  const resolved = await resolveShareUnit(token, unitId);
  if (!resolved.ok) return resolved;

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("booking_forms")
    .select("id, name, public_slug, portfolio_id")
    .eq("tenant_id", resolved.share.tenant_id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  // Forms scoped to the unit's portfolio, plus any global (null-portfolio) forms.
  query = resolved.portfolioId
    ? query.or(`portfolio_id.eq.${resolved.portfolioId},portfolio_id.is.null`)
    : query.is("portfolio_id", null);

  const { data: forms } = await query;
  if (!forms || forms.length === 0) {
    return { ok: false, error: "No booking form is available for this unit yet" };
  }

  return {
    ok: true,
    forms: forms.map((f) => ({ id: f.id, name: f.name, public_slug: f.public_slug })),
    minPrice: resolved.minPrice,
    maxPrice: resolved.maxPrice,
  };
}

export type SendShareBookingFormInput = {
  token: string;
  unitId: string;
  formId: string;
  agentName: string;
  agentEmail: string;
  applicantName: string;
  applicantEmail: string;
  offerPricePcm: number | null;
};

export type SendShareBookingFormResult =
  | { ok: true; bookingReference: string }
  | { ok: false; error: string };

/**
 * Public, no-auth action: an external agent sends a booking form for an
 * available unit on a share link and proposes an in-range offer price. Creates a
 * `pending` booking attributed to the agent (carrying the offer), then emails
 * the prospective applicant the branded booking-form link
 * (/apply/{slug}/{unitId}?price=…&t=…) — which shows the rent + holding deposit.
 *
 * A one-time token is threaded into the link so the applicant's submission binds
 * back to this booking (see submitBookingForm) instead of creating a duplicate.
 */
export async function sendShareBookingForm(
  input: SendShareBookingFormInput
): Promise<SendShareBookingFormResult> {
  const agentName = input.agentName?.trim() ?? "";
  const agentEmail = input.agentEmail?.trim().toLowerCase() ?? "";
  const applicantName = input.applicantName?.trim() ?? "";
  const applicantEmail = input.applicantEmail?.trim().toLowerCase() ?? "";

  if (!agentName) return { ok: false, error: "Enter your name" };
  if (!EMAIL_RE.test(agentEmail)) return { ok: false, error: "Enter a valid email for yourself" };
  if (!EMAIL_RE.test(applicantEmail)) return { ok: false, error: "Enter a valid applicant email" };

  // Rate-limit per token + caller IP: max 5 sends / 10 min.
  const h = headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const rl = rateLimitCheck(`share-book:${input.token}:${ip}`, 10 * 60 * 1000, 5);
  if (!rl.allowed) {
    return { ok: false, error: `Too many requests — try again in ${rl.retryAfterSec}s` };
  }

  const resolved = await resolveShareUnit(input.token, input.unitId);
  if (!resolved.ok) return resolved;
  const { share, minPrice } = resolved;

  // Offer must be a positive number, at least the listed minimum. No upper bound
  // — agents may propose above the listed max.
  const offer = input.offerPricePcm;
  if (offer == null || !Number.isFinite(offer) || offer <= 0) {
    return { ok: false, error: "Enter an offer price" };
  }
  if (minPrice != null && offer < minPrice) {
    return { ok: false, error: `Offer must be at least £${minPrice.toLocaleString("en-GB")}` };
  }
  const offerRounded = Math.round(offer);

  const supabase = createSupabaseAdminClient();

  // Booking form must be active, belong to the tenant, and apply to the unit.
  const { data: form } = await supabase
    .from("booking_forms")
    .select("id, name, public_slug, portfolio_id")
    .eq("id", input.formId)
    .eq("tenant_id", share.tenant_id)
    .eq("is_active", true)
    .maybeSingle<{ id: string; name: string; public_slug: string; portfolio_id: string | null }>();
  if (!form) return { ok: false, error: "Selected form is unavailable" };
  if (form.portfolio_id && form.portfolio_id !== resolved.portfolioId) {
    return { ok: false, error: "Selected form doesn't apply to this unit" };
  }

  // Property id for the booking (units projection carries it via getPublicShareUnits,
  // but re-read here to avoid trusting the earlier list for the write).
  const { data: unitRow } = await supabase
    .from("units")
    .select("property_id")
    .eq("id", input.unitId)
    .eq("tenant_id", share.tenant_id)
    .maybeSingle<{ property_id: string | null }>();

  const sendToken = randomUUID();

  // Create the pending booking now, carrying the agent + offer + one-time token.
  let booking: { id: string; booking_reference: string } | null = null;
  let bookingError: { message?: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        tenant_id: share.tenant_id,
        unit_id: input.unitId,
        property_id: unitRow?.property_id ?? null,
        portfolio_id: form.portfolio_id ?? resolved.portfolioId,
        form_id: form.id,
        applicant_name: applicantName || "Prospective applicant",
        applicant_email: applicantEmail,
        applicant_phone: "",
        booking_reference: generateBookingReference(),
        status: "pending",
        offer_price_pcm: offerRounded,
        agent_name: agentName,
        agent_email: agentEmail,
        source: "share",
        share_id: share.id,
        form_send_token: sendToken,
      })
      .select("id, booking_reference")
      .single();
    if (!error && data) {
      booking = data as { id: string; booking_reference: string };
      break;
    }
    bookingError = error;
    if (error?.code !== "23505") break;
  }
  if (!booking) {
    return { ok: false, error: bookingError?.message ?? "Could not create the booking" };
  }

  try {
    const agency = await loadAgency(share.tenant_id);
    if (!agency) throw new Error("Agency not found");

    // Prefer the portfolio's name as the sender brand (an agency can run several
    // portfolios/brands), falling back to the agency name when the unit/form
    // isn't scoped to a portfolio.
    let senderName = agency.name?.trim() || "Your agency";
    const portfolioId = form.portfolio_id ?? resolved.portfolioId;
    if (portfolioId) {
      const { data: pf } = await supabase
        .from("portfolios")
        .select("name")
        .eq("id", portfolioId)
        .eq("tenant_id", share.tenant_id)
        .maybeSingle<{ name: string | null }>();
      if (pf?.name?.trim()) senderName = pf.name.trim();
    }

    const appUrl = buildTenantAppUrl(h);
    const formUrl =
      `${appUrl}/apply/${form.public_slug}/${input.unitId}` +
      `?price=${offerRounded}&t=${sendToken}`;
    const { subject, html, text } = generateFormLinkEmail({
      formName: form.name,
      formUrl,
      agencyName: senderName,
    });
    await sendAgencyEmail({ agency, to: applicantEmail, subject, html, text });
  } catch (err) {
    // Roll back so a failed email doesn't leave an orphan pending booking.
    await supabase.from("bookings").delete().eq("id", booking.id);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send the form email" };
  }

  return { ok: true, bookingReference: booking.booking_reference };
}
