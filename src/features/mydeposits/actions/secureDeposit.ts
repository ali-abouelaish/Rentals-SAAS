"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMdContext } from "@/lib/mydeposits/apiClient";
import { MD_API_VERSION } from "@/lib/mydeposits/config";
import {
  addPropertyByAgency,
  canLandlordBeInvited,
  createTenancy,
  getDepositAmount,
  createDeposit,
  createDepositPayment,
  getPaymentDetails,
  type TenancyTenant,
} from "@/lib/mydeposits/realityStone";
import { secureDepositSchema, type SecureDepositInput, type MdProtection } from "../domain/types";

export type SecureDepositResult = {
  ok: boolean;
  protectionId: string;
  status: MdProtection["status"];
  warning?: string;
  paymentInstructions?: Record<string, unknown> | null;
};

/**
 * Idempotent, resumable orchestration. Each remote id is persisted immediately
 * so a re-run after a mid-flow failure resumes rather than duplicating remote
 * entities. Steps are guarded by the presence of the corresponding remote id.
 */
export async function secureDeposit(input: SecureDepositInput): Promise<SecureDepositResult> {
  const parsed = secureDepositSchema.parse(input);
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // 1. Load the contract (RLS confirms tenant ownership).
  const { data: contract, error: contractErr } = await supabase
    .from("property_contracts")
    .select(`
      id, tenant_id, deposit, deposit_scheme, start_date, expiry_date, rent_pcm,
      unit:units(
        property:properties(address_line_1, address_line_2, postcode, area)
      )
    `)
    .eq("id", parsed.contractId)
    .single();
  if (contractErr || !contract) throw new Error("Contract not found.");
  if (contract.deposit_scheme !== "mydeposits") {
    throw new Error("Contract deposit scheme is not set to mydeposits.");
  }

  const property = (contract.unit as { property?: Record<string, string | null> } | null)?.property;
  if (!property?.address_line_1) throw new Error("Property address is incomplete.");

  const ctx = await getMdContext(profile.tenant_id);
  const admin = ctx.admin;
  const depositPence = Math.round((contract.deposit ?? 0) * 100);

  // 2. Upsert the protection row (unique on contract_id).
  const { data: upserted, error: upsertErr } = await admin
    .from("mydeposits_protections")
    .upsert(
      {
        tenant_id: profile.tenant_id,
        contract_id: contract.id,
        status: "draft",
        deposit_amount_pence: depositPence,
        api_version: MD_API_VERSION,
        created_by: profile.id,
      },
      { onConflict: "contract_id", ignoreDuplicates: false }
    )
    .select("*")
    .single();
  if (upsertErr || !upserted) throw new Error(upsertErr?.message ?? "Failed to create protection.");

  let row = upserted as MdProtection;
  const pid = row.id;
  let warning: string | undefined;

  const patch = async (fields: Record<string, unknown>) => {
    const { data } = await admin
      .from("mydeposits_protections")
      .update(fields)
      .eq("id", pid)
      .select("*")
      .single();
    if (data) row = data as MdProtection;
  };

  // 3. Property.
  if (!row.remote_property_id) {
    if (parsed.landlord?.email) {
      await canLandlordBeInvited(ctx, parsed.landlord.email, pid).catch(() => null);
    }
    const { propertyId } = await addPropertyByAgency(
      ctx,
      {
        addressLine1: property.address_line_1 as string,
        addressLine2: property.address_line_2 ?? null,
        postcode: property.postcode ?? null,
        area: property.area ?? null,
      },
      pid
    );
    if (!propertyId) throw new Error("mydeposits did not return a property id.");
    await patch({ remote_property_id: propertyId });
  }

  // 4. Tenancy.
  if (!row.remote_tenancy_id) {
    const tenants: TenancyTenant[] = parsed.tenants.map((t) => ({
      fullName: t.fullName,
      email: t.email,
      phone: t.phone ?? null,
      dob: t.dob ?? null,
      isLead: t.isLead,
    }));
    const { tenancyId } = await createTenancy(
      ctx,
      {
        propertyId: row.remote_property_id!,
        startDate: contract.start_date,
        expiryDate: contract.expiry_date,
        rentAmount: contract.rent_pcm,
        rentFrequency: "monthly",
        tenants,
      },
      pid
    );
    if (!tenancyId) throw new Error("mydeposits did not return a tenancy id.");
    await patch({ remote_tenancy_id: tenancyId });
  }

  // 5. Reconcile the expected deposit amount (advisory only).
  try {
    const remoteAmount = await getDepositAmount(ctx, row.remote_tenancy_id!, pid);
    if (remoteAmount != null && Math.round(remoteAmount * 100) !== depositPence) {
      warning = `Deposit mismatch: contract £${contract.deposit} vs scheme £${remoteAmount}.`;
    }
  } catch {
    // Non-fatal: reconcile is best-effort.
  }

  // 6. Deposit.
  if (!row.remote_deposit_id) {
    const { depositId, status } = await createDeposit(
      ctx,
      { tenancyId: row.remote_tenancy_id!, amount: contract.deposit },
      pid
    );
    if (!depositId) throw new Error("mydeposits did not return a deposit id.");
    await patch({
      remote_deposit_id: depositId,
      remote_deposit_status: status,
      status: "created_remote",
    });
    // Mirror the scheme reference onto the contract immediately.
    await admin
      .from("property_contracts")
      .update({ deposit_scheme_ref: depositId })
      .eq("id", contract.id);
  }

  // 7. Payment (bank transfer / unallocated funds) + cache instructions.
  if (!row.remote_payment_id) {
    const { paymentId } = await createDepositPayment(
      ctx,
      { depositId: row.remote_deposit_id!, method: "bank_transfer" },
      pid
    );
    if (!paymentId) throw new Error("mydeposits did not return a payment id.");
    const details = await getPaymentDetails(ctx, paymentId, pid).catch(() => null);
    await patch({
      remote_payment_id: paymentId,
      payment_instructions: details,
      status: "awaiting_payment",
    });
  }

  revalidatePath("/deposits");
  revalidatePath("/contracts");

  return {
    ok: true,
    protectionId: pid,
    status: row.status,
    warning,
    paymentInstructions: row.payment_instructions,
  };
}
