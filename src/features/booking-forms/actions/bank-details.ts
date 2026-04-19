"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { bankDetailsSchema, type BankDetailsValues } from "../domain/schemas";

export async function updateBankDetails(values: BankDetailsValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = bankDetailsSchema.parse(values);

  const { error } = await supabase
    .from("tenant_bank_details")
    .upsert(
      {
        tenant_id: profile.tenant_id,
        account_holder_name: payload.account_holder_name ?? null,
        account_number: payload.account_number ?? null,
        sort_code: payload.sort_code ?? null,
        bank_name: payload.bank_name ?? null,
        payment_reference_hint: payload.payment_reference_hint ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/settings/bank-details");
}
