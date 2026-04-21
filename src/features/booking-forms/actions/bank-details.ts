"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { bankDetailsSchema, type BankDetailsValues } from "../domain/schemas";

export async function updateBankDetailsForForm(formId: string, values: BankDetailsValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = bankDetailsSchema.parse(values);

  const { data: form, error: formError } = await supabase
    .from("booking_forms")
    .select("id")
    .eq("id", formId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (formError) throw new Error(formError.message);
  if (!form) throw new Error("Form not found");

  const { error } = await supabase
    .from("booking_form_bank_details")
    .upsert(
      {
        form_id: formId,
        tenant_id: profile.tenant_id,
        account_holder_name: payload.account_holder_name ?? null,
        account_number: payload.account_number ?? null,
        sort_code: payload.sort_code ?? null,
        bank_name: payload.bank_name ?? null,
        payment_reference_hint: payload.payment_reference_hint ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "form_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/settings/bank-details");
}
