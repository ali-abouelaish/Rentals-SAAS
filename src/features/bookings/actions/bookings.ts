"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { generateContractFromTemplate } from "@/features/contracts/templates/actions/generate";
import { listContractTemplatesForBookingAction } from "@/features/contracts/templates/actions/templates";
import type { BookingStatus } from "../domain/types";

export type ConvertContractInput = {
  templateId: string;
  start_date: string;
  expiry_date?: string | null;
  rent_pcm: number;
  deposit: number;
  manualValues: Record<string, string>;
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

export async function approveBooking(id: string, signedAndPaid = false) {
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
    await supabase
      .from("units")
      .update({
        status: unitStatus,
        pm_tenant_id: pmTenant.id,
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
        start_date: format(new Date(), "yyyy-MM-dd"),
        rent_pcm: 0, // Admin fills in the details
        deposit: 0,
        status: contractStatus,
        deposit_protection_deadline: format(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        ),
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

/**
 * Templates + unit-derived defaults for the convert-to-tenancy contract form.
 * rent/deposit are stored in pounds (same convention as property_contracts).
 */
export async function getBookingContractSetup(bookingId: string): Promise<{
  templates: { id: string; name: string; page_count: number; portfolio_id: string | null }[];
  defaults: { rent_pcm: number | null; deposit: number | null };
}> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("portfolio_id, unit_id, offer_price_pcm")
    .eq("id", bookingId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  const templates = await listContractTemplatesForBookingAction(booking?.portfolio_id ?? null);

  let defaults: { rent_pcm: number | null; deposit: number | null } = { rent_pcm: null, deposit: null };
  if (booking?.unit_id) {
    const { data: unit } = await supabase
      .from("units")
      .select("min_price_pcm, max_price_pcm, deposit")
      .eq("id", booking.unit_id)
      .eq("tenant_id", profile.tenant_id)
      .single();
    if (unit) {
      defaults = {
        // Prefer the agent's agreed offer (share bookings) over the unit's range.
        rent_pcm: booking.offer_price_pcm ?? unit.min_price_pcm ?? unit.max_price_pcm ?? null,
        deposit: unit.deposit ?? null,
      };
    }
  }

  return { templates, defaults };
}

/**
 * Approve a booking (create tenant + contract) and, when contract details are
 * supplied, immediately stamp the chosen template so the contract drawer opens
 * with a PDF already attached.
 */
export async function convertBookingToTenancy(
  bookingId: string,
  opts: { signedAndPaid: boolean; contract?: ConvertContractInput }
): Promise<{ pmTenantId: string; contractId: string | null; generated: boolean }> {
  const { pmTenantId, contractId } = await approveBooking(bookingId, opts.signedAndPaid);

  if (opts.contract && contractId) {
    await generateContractFromTemplate({
      templateId: opts.contract.templateId,
      bookingId,
      contractId,
      manualValues: opts.contract.manualValues,
      contractDefaults: {
        start_date: opts.contract.start_date,
        expiry_date: opts.contract.expiry_date ?? null,
        rent_pcm: opts.contract.rent_pcm,
        deposit: opts.contract.deposit,
      },
    });
    revalidatePath("/contracts");
    revalidatePath("/tenants");
    return { pmTenantId, contractId, generated: true };
  }

  return { pmTenantId, contractId, generated: false };
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
