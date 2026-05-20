"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function deleteUpload(uploadId: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("bank_statement_uploads").delete().eq("id", uploadId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/rent-collection/statements");
  return { ok: true };
}

export async function resolveFlag(flagId: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("rent_payment_flags")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", flagId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/rent-collection/statements");
  return { ok: true };
}
