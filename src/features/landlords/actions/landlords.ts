"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile, requireRole } from "@/lib/auth/requireRole";

function parseLandlordFormData(formData: FormData) {
  const paysCommission = String(formData.get("pays_commission") ?? "yes") === "yes";
  const weDoViewing = String(formData.get("we_do_viewing") ?? "yes") === "yes";
  const amountRaw = String(formData.get("commission_amount_gbp") ?? "");
  const amountValue = Number(amountRaw);
  const commissionAmount = Number.isFinite(amountValue) ? amountValue : 0;
  return {
    name: String(formData.get("name") ?? "").trim(),
    contact: String(formData.get("contact") ?? "").trim() || null,
    billing_address: String(formData.get("billing_address") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    spareroom_profile_url: String(formData.get("spareroom_profile_url") ?? "").trim() || null,
    pays_commission: paysCommission,
    commission_amount_gbp: paysCommission ? commissionAmount : 0,
    commission_term_text: String(formData.get("commission_term_text") ?? "").trim() || null,
    we_do_viewing: weDoViewing,
    profile_notes: String(formData.get("profile_notes") ?? "").trim() || null,
  };
}

export async function createLandlord(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const payload = parseLandlordFormData(formData);
  const { data, error } = await supabase
    .from("landlords")
    .insert({
      tenant_id: profile.tenant_id,
      name: payload.name,
      contact: payload.contact,
      billing_address: payload.billing_address,
      email: payload.email,
      spareroom_profile_url: payload.spareroom_profile_url,
      pays_commission: payload.pays_commission,
      commission_amount_gbp: payload.commission_amount_gbp,
      commission_term_text: payload.commission_term_text,
      we_do_viewing: payload.we_do_viewing,
      profile_notes: payload.profile_notes,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/landlords");
  redirect(`/landlords/${data.id}`);
}

export async function deleteLandlord(formData: FormData) {
  const supabase = createSupabaseServerClient();
  await requireRole(["admin"]);
  const landlordId = String(formData.get("landlord_id") ?? "");
  if (!landlordId) throw new Error("Missing landlord id.");

  const { error } = await supabase.from("landlords").delete().eq("id", landlordId);
  if (error) throw new Error(error.message);

  revalidatePath("/landlords");
  redirect("/landlords");
}

  const supabase = createSupabaseServerClient();
  await requireUserProfile();
  const landlordId = String(formData.get("landlord_id") ?? "");
  if (!landlordId) throw new Error("Missing landlord id.");

  const payload = parseLandlordFormData(formData);

  const { error } = await supabase
    .from("landlords")
    .update({
      name: payload.name,
      contact: payload.contact,
      billing_address: payload.billing_address,
      email: payload.email,
      spareroom_profile_url: payload.spareroom_profile_url,
      pays_commission: payload.pays_commission,
      commission_amount_gbp: payload.commission_amount_gbp,
      commission_term_text: payload.commission_term_text,
      we_do_viewing: payload.we_do_viewing,
      profile_notes: payload.profile_notes,
    })
    .eq("id", landlordId);
  if (error) throw new Error(error.message);

  revalidatePath(`/landlords/${landlordId}`);
  revalidatePath("/landlords");
}
