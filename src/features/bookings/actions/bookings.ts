"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { BookingStatus } from "../domain/types";

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

export async function approveBooking(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // 1. Fetch the booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*, form_responses(*, question:form_questions(question_text))")
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

  // 4. If unit_id is set: update unit status to booked + link pm_tenant
  if (booking.unit_id) {
    await supabase
      .from("units")
      .update({
        status: "booked",
        pm_tenant_id: pmTenant.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.unit_id)
      .eq("tenant_id", profile.tenant_id);

    // 5. Draft a contract record
    await supabase
      .from("property_contracts")
      .insert({
        tenant_id: profile.tenant_id,
        unit_id: booking.unit_id,
        pm_tenant_id: pmTenant.id,
        start_date: format(new Date(), "yyyy-MM-dd"),
        rent_pcm: 0, // Admin fills in the details
        deposit: 0,
        status: "draft",
        deposit_protection_deadline: format(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        ),
      });
  }

  revalidatePath("/bookings");
  revalidatePath("/tenants");
  revalidatePath("/contracts");
  revalidatePath("/properties");

  return { pmTenantId: pmTenant.id };
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
