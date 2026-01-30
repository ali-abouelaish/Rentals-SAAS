"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";

export async function createBillingProfile(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);
  const termsRaw = String(formData.get("default_payment_terms_days") ?? "");
  const termsValue = Number(termsRaw);
  const termsDays = Number.isFinite(termsValue) && termsValue > 0 ? termsValue : 7;

  const { error } = await supabase.from("billing_profiles").insert({
    tenant_id: profile.tenant_id,
    name: String(formData.get("name") ?? ""),
    sender_company_name: String(formData.get("sender_company_name") ?? ""),
    sender_address: String(formData.get("sender_address") ?? ""),
    sender_email: String(formData.get("sender_email") ?? ""),
    sender_phone: String(formData.get("sender_phone") ?? ""),
    bank_account_holder_name: String(formData.get("bank_account_holder_name") ?? ""),
    bank_account_number: String(formData.get("bank_account_number") ?? ""),
    bank_sort_code: String(formData.get("bank_sort_code") ?? ""),
    default_payment_terms_days: termsDays,
    footer_thank_you_text: String(formData.get("footer_thank_you_text") ?? "Thank you for your business!")
  });
  if (error) throw new Error(error.message);

  revalidatePath("/settings/billing-profiles");
}

export async function updateBillingProfile(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);
  const billingProfileId = String(formData.get("billing_profile_id") ?? "");
  const termsRaw = String(formData.get("default_payment_terms_days") ?? "");
  const termsValue = Number(termsRaw);
  const termsDays = Number.isFinite(termsValue) && termsValue > 0 ? termsValue : 7;

  if (!billingProfileId) throw new Error("Missing billing profile id.");

  const { error } = await supabase
    .from("billing_profiles")
    .update({
      name: String(formData.get("name") ?? ""),
      sender_company_name: String(formData.get("sender_company_name") ?? ""),
      sender_address: String(formData.get("sender_address") ?? ""),
      sender_email: String(formData.get("sender_email") ?? ""),
      sender_phone: String(formData.get("sender_phone") ?? ""),
      bank_account_holder_name: String(formData.get("bank_account_holder_name") ?? ""),
      bank_account_number: String(formData.get("bank_account_number") ?? ""),
      bank_sort_code: String(formData.get("bank_sort_code") ?? ""),
      default_payment_terms_days: termsDays,
      footer_thank_you_text: String(
        formData.get("footer_thank_you_text") ?? "Thank you for your business!"
      ),
      updated_at: new Date().toISOString()
    })
    .eq("id", billingProfileId)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/billing-profiles");
}

export async function deleteBillingProfile(profileId: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);
  const { error } = await supabase
    .from("billing_profiles")
    .delete()
    .eq("id", profileId)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/billing-profiles");
}

export async function uploadBillingLogo(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const profile = await requireRole(["admin"]);
  const billingProfileId = String(formData.get("billing_profile_id") ?? "");
  const file = formData.get("file") as File | null;
  if (!billingProfileId || !file) throw new Error("Missing file.");

  const path = `${profile.tenant_id}/${billingProfileId}/${file.name}`;
  const { error: uploadError } = await admin.storage
    .from("billing-logos")
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase
    .from("billing_profiles")
    .update({ logo_url: path })
    .eq("id", billingProfileId)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/billing-profiles");
}

export async function getEmailTemplate() {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .eq("key", "invoice_send")
    .single();
  return data;
}
