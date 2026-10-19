"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { generateContractFromTemplate } from "@/features/contracts/templates/actions/generate";
import { listContractTemplatesForBookingAction } from "@/features/contracts/templates/actions/templates";
import { contractTermsSchema } from "@/features/contracts/templates/domain/schemas";
import type { ActionResult } from "@/features/contracts/templates/domain/types";
import { addDaysIso, ukToday } from "@/features/contracts/templates/lib/resolver";
import {
  findGenerationTarget,
  generationLockReason,
} from "@/features/contracts/templates/lib/contract-lock";
import type { BookingStatus } from "../domain/types";

export type ConvertContractInput = {
  // Null = no PDF now ("generate later") — the terms below still apply.
  templateId: string | null;
  start_date: string;
  expiry_date?: string | null;
  rent_pcm: number;
  deposit: number;
  manualValues: Record<string, string>;
};

export type ContractDetailsInput = {
  start_date: string;
  expiry_date?: string | null;
  rent_pcm: number;
  deposit: number;
};

export async function updateBookingStatus(id: string, status: BookingStatus) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/bookings");
}

export async function rejectBooking(id: string, rejectionReason: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "rejected",
      rejection_reason: rejectionReason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile.id,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/bookings");
}

export async function approveBooking(
  id: string,
  signedAndPaid = false,
  details?: ContractDetailsInput
) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // 1. Fetch the booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*, form_responses(*, question:booking_form_questions(question_text))")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (bookingError || !booking) throw new Error(bookingError?.message ?? "Booking not found");
  if (booking.status === "approved") throw new Error("Booking is already approved");

  // 2. Create pm_tenant from applicant details
  const { data: pmTenant, error: pmTenantError } = await supabase
    .from("pm_tenants")
    .insert({
      tenant_id: profile.tenant_id,
      full_name: booking.applicant_name,
      email: booking.applicant_email,
      phone: booking.applicant_phone,
    })
    .select("id")
    .single();

  if (pmTenantError || !pmTenant) throw new Error(pmTenantError?.message ?? "Failed to create tenant");

  // 3. Update booking — mark approved + link pm_tenant
  const { error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      status: "approved",
      converted_pm_tenant_id: pmTenant.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile.id,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (updateBookingError) throw new Error(updateBookingError.message);

  const unitStatus = signedAndPaid ? "occupied" : "booked";
  const contractStatus = signedAndPaid ? "active" : "draft";

  // 4. If unit_id is set: update unit status + link pm_tenant
  let contractId: string | null = null;
  if (booking.unit_id) {
    if (details) {
      if (!details.start_date) throw new Error("Contract start date is required");
      if (!Number.isFinite(details.rent_pcm) || details.rent_pcm <= 0) {
        throw new Error("Contract rent must be greater than 0");
      }
      if (!Number.isFinite(details.deposit) || details.deposit < 0) {
        throw new Error("Contract deposit must be 0 or more");
      }
      if (details.expiry_date && details.expiry_date <= details.start_date) {
        throw new Error("Contract expiry must be after the start date");
      }
    }

    // Read the unit's pricing before overwriting its status so the contract can
    // be seeded with real terms when the caller doesn't supply any.
    const { data: unit } = await supabase
      .from("units")
      .select("min_price_pcm, max_price_pcm, deposit")
      .eq("id", booking.unit_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    await supabase
      .from("units")
      .update({
        status: unitStatus,
        pm_tenant_id: pmTenant.id,
        // Tenancies are rolling (no expiry), so the unit has no known next-free
        // date — clear it (renders as "—") once a contract exists.
        available_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.unit_id)
      .eq("tenant_id", profile.tenant_id);

    // 5. Open a contract record (draft if not signed/paid yet, active if both done)
    const { data: createdContract } = await supabase
      .from("property_contracts")
      .insert({
        tenant_id: profile.tenant_id,
        unit_id: booking.unit_id,
        pm_tenant_id: pmTenant.id,
        start_date: details?.start_date ?? ukToday(),
        expiry_date: details?.expiry_date ?? null,
        // Fall back to the terms already agreed (offer price, unit pricing) so a
        // conversion without explicit details never opens a £0 contract.
        rent_pcm:
          details?.rent_pcm ??
          booking.offer_price_pcm ??
          unit?.min_price_pcm ??
          unit?.max_price_pcm ??
          0,
        deposit: details?.deposit ?? unit?.deposit ?? 0,
        status: contractStatus,
        // Statutory clock runs from the tenancy start, not from when the admin
        // happened to click convert.
        // Pure calendar arithmetic — parsing the date as UTC and adding days in
        // local time loses a day across the spring clock change.
        deposit_protection_deadline: addDaysIso(details?.start_date ?? ukToday(), 30),
      })
      .select("id")
      .single();
    contractId = createdContract?.id ?? null;
  }

  revalidatePath("/bookings");
  revalidatePath("/tenants");
  revalidatePath("/contracts");
  revalidatePath("/properties");

  return { pmTenantId: pmTenant.id, contractId, contractStatus, unitStatus };
}

export type BookingContractSetup = {
  templates: { id: string; name: string; page_count: number; portfolio_id: string | null }[];
  /** Prefill for the terms. Money is whole pounds (same as property_contracts). */
  defaults: {
    start_date: string | null;
    expiry_date: string | null;
    rent_pcm: number | null;
    deposit: number | null;
  };
  /** The contract a PDF would be stamped onto, once the booking is converted. */
  contract: { id: string; status: string; hasPdf: boolean; lockedReason: string | null } | null;
};

/**
 * Templates + defaults for the contract forms. Before conversion the terms come
 * from the agreed offer and the unit; afterwards from the tenancy's contract,
 * so re-generating never silently replaces its rent with a blank or a listing
 * price — and the dialog can say up front when the contract can't be changed.
 */
export async function getBookingContractSetup(bookingId: string): Promise<BookingContractSetup> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("portfolio_id, unit_id, offer_price_pcm, status, converted_pm_tenant_id")
    .eq("id", bookingId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  const templates = await listContractTemplatesForBookingAction(booking?.portfolio_id ?? null);

  const setup: BookingContractSetup = {
    templates,
    defaults: { start_date: null, expiry_date: null, rent_pcm: null, deposit: null },
    contract: null,
  };
  if (!booking?.unit_id) return setup;

  if (booking.status === "approved" && booking.converted_pm_tenant_id) {
    const target = await findGenerationTarget(
      supabase,
      profile.tenant_id,
      booking.unit_id,
      booking.converted_pm_tenant_id
    );
    if (target) {
      setup.defaults = {
        start_date: target.start_date,
        expiry_date: target.expiry_date,
        rent_pcm: target.rent_pcm > 0 ? target.rent_pcm : null,
        deposit: target.deposit,
      };
      setup.contract = {
        id: target.id,
        status: target.status,
        hasPdf: Boolean(target.generated_pdf_path),
        lockedReason: await generationLockReason(supabase, target),
      };
      return setup;
    }
  }

  const { data: unit } = await supabase
    .from("units")
    .select("min_price_pcm, max_price_pcm, deposit")
    .eq("id", booking.unit_id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (unit) {
    setup.defaults = {
      start_date: null,
      expiry_date: null,
      // Prefer the agent's agreed offer (share bookings) over the unit's range.
      rent_pcm: booking.offer_price_pcm ?? unit.min_price_pcm ?? unit.max_price_pcm ?? null,
      deposit: unit.deposit ?? null,
    };
  }
  return setup;
}

export type ConvertResult = ActionResult<{
  pmTenantId: string;
  contractId: string | null;
  generated: boolean;
  /** Set when the booking converted but its PDF couldn't be generated. */
  generateError: string | null;
  warnings: string[];
}>;

/**
 * Approve a booking (create tenant + contract) and, when a template is chosen,
 * immediately stamp it so the contract drawer opens with a PDF attached.
 *
 * Conversion and generation are separate steps: if generation fails, the
 * conversion has still happened, and the result says so rather than reporting
 * a failure the agent would retry into "Booking is already approved".
 */
export async function convertBookingToTenancy(
  bookingId: string,
  opts: { signedAndPaid: boolean; contract?: ConvertContractInput }
): Promise<ConvertResult> {
  await requireRole([...ADMIN_ROLES]);

  if (opts.contract) {
    const terms = contractTermsSchema.safeParse({
      start_date: opts.contract.start_date,
      expiry_date: opts.contract.expiry_date || null,
      rent_pcm: opts.contract.rent_pcm,
      deposit: opts.contract.deposit,
      collection_date: null,
      deposit_scheme: null,
    });
    if (!terms.success) {
      return { ok: false, error: terms.error.issues[0]?.message ?? "Check the contract details." };
    }
  }

  let approved: Awaited<ReturnType<typeof approveBooking>>;
  try {
    approved = await approveBooking(
      bookingId,
      opts.signedAndPaid,
      opts.contract
        ? {
            start_date: opts.contract.start_date,
            expiry_date: opts.contract.expiry_date ?? null,
            rent_pcm: opts.contract.rent_pcm,
            deposit: opts.contract.deposit,
          }
        : undefined
    );
  } catch (err) {
    // Thrown messages are replaced in production before they reach the client.
    return { ok: false, error: err instanceof Error ? err.message : "The booking couldn't be converted." };
  }
  const { pmTenantId, contractId } = approved;

  if (opts.contract?.templateId && contractId) {
    const gen = await generateContractFromTemplate({
      templateId: opts.contract.templateId,
      bookingId,
      contractId,
      manualValues: opts.contract.manualValues,
      terms: {
        start_date: opts.contract.start_date,
        expiry_date: opts.contract.expiry_date ?? null,
        rent_pcm: opts.contract.rent_pcm,
        deposit: opts.contract.deposit,
        collection_date: null,
        deposit_scheme: null,
      },
    });
    revalidatePath("/contracts");
    revalidatePath("/tenants");
    if (!gen.ok) {
      return { ok: true, pmTenantId, contractId, generated: false, generateError: gen.error, warnings: [] };
    }
    return { ok: true, pmTenantId, contractId, generated: true, generateError: null, warnings: gen.warnings };
  }

  return { ok: true, pmTenantId, contractId, generated: false, generateError: null, warnings: [] };
}

export async function updateBookingNotes(id: string, notes: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("bookings")
    .update({ notes })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/bookings");
}
