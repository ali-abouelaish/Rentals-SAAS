"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { ownerUpdateSchema, type OwnerUpdateValues } from "../domain/schemas";
import {
  ownerLandlordSchema,
  type OwnerLandlordFormValues,
} from "@/features/properties/domain/schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateOwnerPages(ownerId?: string) {
  revalidatePath("/owners");
  if (ownerId) revalidatePath(`/owners/${ownerId}`);
  // The property form's owner dropdown reads the same table.
  revalidatePath("/properties");
}

/** Empty string → null, so a cleared input clears the column. */
function blankToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createOwner(
  values: OwnerLandlordFormValues
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const parsed = ownerLandlordSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("owner_landlords")
    .insert({
      tenant_id: profile.tenant_id,
      name: d.name.trim(),
      phone: blankToNull(d.phone),
      email: blankToNull(d.email),
      address: blankToNull(d.address),
      notes: blankToNull(d.notes),
      contract_start_date: blankToNull(d.contract_start_date),
      contract_expiry_date: blankToNull(d.contract_expiry_date),
      monthly_rent_owed: d.monthly_rent_owed ?? null,
      payment_schedule: d.payment_schedule ?? null,
      management_fee_type: d.management_fee_type,
      management_fee_percent: d.management_fee_type === "percent" ? d.management_fee_percent ?? null : null,
      management_fee_amount: d.management_fee_type === "flat" ? d.management_fee_amount ?? null : null,
      alert_60_days: d.alert_60_days,
      alert_30_days: d.alert_30_days,
      contract_document_url: blankToNull(d.contract_document_url),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidateOwnerPages(data.id as string);
  return { ok: true, id: data.id as string };
}

/**
 * Full-record update from the owner detail page.
 *
 * Unlike `updateOwnerLandlord` in the properties feature (which strips nulls
 * and therefore cannot clear a column), this writes every field, so blanking
 * an input actually clears it. Fee values for the non-selected fee type are
 * nulled so a stale percentage can't resurface if the type is switched back.
 */
export async function updateOwner(values: OwnerUpdateValues): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const parsed = ownerUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("owner_landlords")
    .update({
      name: d.name,
      phone: blankToNull(d.phone),
      email: blankToNull(d.email),
      address: blankToNull(d.address),
      notes: blankToNull(d.notes),
      contract_start_date: blankToNull(d.contract_start_date),
      contract_expiry_date: blankToNull(d.contract_expiry_date),
      next_payment_due: blankToNull(d.next_payment_due),
      payment_schedule: blankToNull(d.payment_schedule),
      monthly_rent_owed: d.monthly_rent_owed ?? null,
      management_fee_type: d.management_fee_type,
      management_fee_percent: d.management_fee_type === "percent" ? d.management_fee_percent ?? null : null,
      management_fee_amount: d.management_fee_type === "flat" ? d.management_fee_amount ?? null : null,
      alert_60_days: d.alert_60_days,
      alert_30_days: d.alert_30_days,
    })
    .eq("id", d.id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidateOwnerPages(d.id);
  return { ok: true };
}

/**
 * Delete an owner. Refused while they still hold statements — the FK cascades,
 * so deleting would destroy issued financial records rather than orphan them.
 * Properties merely lose their owner link (on delete set null), so those are
 * only warned about, not blocked.
 */
export async function deleteOwner(ownerId: string): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { count, error: countErr } = await supabase
    .from("owner_statements")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("tenant_id", profile.tenant_id);
  if (countErr) return { ok: false, error: countErr.message };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `This landlord has ${count} statement${count === 1 ? "" : "s"}. Void them first, or keep the record for your audit trail.`,
    };
  }

  const { error } = await supabase
    .from("owner_landlords")
    .delete()
    .eq("id", ownerId)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidateOwnerPages();
  return { ok: true };
}
