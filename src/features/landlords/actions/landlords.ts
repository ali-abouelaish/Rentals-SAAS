"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";

export async function updateLandlord(formData: FormData) {
  const supabase = createSupabaseServerClient();
  await requireRole(["admin"]);
  const landlordId = String(formData.get("landlord_id") ?? "");
  if (!landlordId) throw new Error("Missing landlord id.");

  const paysCommission = String(formData.get("pays_commission") ?? "yes") === "yes";
  const weDoViewing = String(formData.get("we_do_viewing") ?? "yes") === "yes";

  const amountRaw = String(formData.get("commission_amount_gbp") ?? "");
  const amountValue = Number(amountRaw);
  const commissionAmount = Number.isFinite(amountValue) ? amountValue : 0;

  const { error } = await supabase
    .from("landlords")
    .update({
      name: String(formData.get("name") ?? ""),
      contact: String(formData.get("contact") ?? ""),
      billing_address: String(formData.get("billing_address") ?? ""),
      email: String(formData.get("email") ?? ""),
      spareroom_profile_url: String(formData.get("spareroom_profile_url") ?? ""),
      pays_commission: paysCommission,
      commission_amount_gbp: paysCommission ? commissionAmount : 0,
      commission_term_text: String(formData.get("commission_term_text") ?? ""),
      we_do_viewing: weDoViewing,
      profile_notes: String(formData.get("profile_notes") ?? "")
    })
    .eq("id", landlordId);
  if (error) throw new Error(error.message);

  revalidatePath(`/landlords/${landlordId}`);
  revalidatePath("/landlords");
}
