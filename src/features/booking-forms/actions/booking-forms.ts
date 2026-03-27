"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { BookingFormValues } from "../domain/schemas";

function generateSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function createBookingForm(values: BookingFormValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("booking_forms")
    .insert({
      tenant_id: profile.tenant_id,
      name: values.name,
      description: values.description || null,
      portfolio_id: values.portfolio_id || null,
      is_active: values.is_active ?? true,
      public_slug: generateSlug(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/settings/booking-forms");
  return data;
}

export async function updateBookingForm(id: string, values: Partial<BookingFormValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("booking_forms")
    .update({
      name: values.name,
      description: values.description || null,
      portfolio_id: values.portfolio_id || null,
      is_active: values.is_active,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/booking-forms");
}

export async function deleteBookingForm(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("booking_forms")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/booking-forms");
}
