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
  getAvailableDepositSchemes,
  createDeposit,
  createDepositPayment,
  getPaymentDetails,
  type TenancyTenant,
} from "@/lib/mydeposits/realityStone";
import { getOffices } from "@/lib/mydeposits/spaceStone";
import { secureDepositSchema, type SecureDepositInput, type MdProtection } from "../domain/types";

/** `look-up/property-types` id 1 = "other" — our schema has no property type. */
const MD_PROPERTY_TYPE_OTHER = 1;
/** `look-up/rent-frequencies` id 2 = monthly; contracts store rent as PCM. */
const MD_RENT_FREQUENCY_MONTHLY = 2;

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
  //
  // mydeposits needs an office to hang the property off, plus a country/region
  // pair as objects. The agency's own office record carries both, so one
  // lookup supplies officeId and the address defaults without a second call.
  if (!row.remote_property_id) {
    const offices = await getOffices(ctx);
    const office = offices[0];
    if (!office) throw new Error("mydeposits returned no offices for this agency.");
    const country = office.address?.country ?? { id: 225, iso: "GB", text: "United Kingdom" };
    const region = office.address?.region ?? null;

    const landlord = {
      email: parsed.landlord.email,
      firstName: parsed.landlord.firstName,
      lastName: parsed.landlord.lastName,
      phone: parsed.landlord.phone,
    };

    // Advisory pre-flight: a "no" here means the invite will fail, but the
    // create call returns the authoritative error either way.
    const { canBeInvited } = await canLandlordBeInvited(ctx, landlord, office.id, {}, pid);
    if (!canBeInvited) {
      warning = `mydeposits will not invite ${landlord.email} — check the landlord's account.`;
    }

    const { propertyId } = await addPropertyByAgency(
      ctx,
      {
        officeId: office.id,
        name: (property.address_line_1 as string).slice(0, 100),
        propertyTypeId: MD_PROPERTY_TYPE_OTHER,
        landlord,
        address: {
          addressLine1: property.address_line_1 as string,
          addressLine2: property.address_line_2 ?? null,
          city: property.area ?? "",
          postcode: property.postcode ?? "",
          country,
          region,
          isAddressSetManually: true,
        },
      },
      pid
    );
    if (!propertyId) throw new Error("mydeposits did not return a property id.");
    await patch({ remote_property_id: propertyId });
  }

  // 4. Tenancy.
  if (!row.remote_tenancy_id) {
    const tenants: TenancyTenant[] = parsed.tenants.map((t) => ({
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone ?? null,
      dob: t.dob ?? null,
      isLeadTenant: t.isLead,
    }));
    const { tenancyId } = await createTenancy(
      ctx,
      {
        propertyId: row.remote_property_id!,
        tenancyName: `${property.address_line_1} — ${contract.start_date}`.slice(0, 100),
        startDate: contract.start_date,
        endDate: contract.expiry_date,
        rent: contract.rent_pcm,
        rentFrequencyId: MD_RENT_FREQUENCY_MONTHLY,
        tenants,
      },
      pid
    );
    if (!tenancyId) throw new Error("mydeposits did not return a tenancy id.");
    await patch({ remote_tenancy_id: tenancyId });
  }

  // 5. Reconcile the expected deposit amount (advisory only).
  try {
    const remoteAmount = await getDepositAmount(
      ctx,
      { rent: contract.rent_pcm, rentFrequencyId: MD_RENT_FREQUENCY_MONTHLY },
      pid
    );
    if (remoteAmount != null && Math.round(remoteAmount * 100) !== depositPence) {
      warning = `Deposit mismatch: contract £${contract.deposit} vs scheme £${remoteAmount}.`;
    }
  } catch {
    // Non-fatal: reconcile is best-effort.
  }

  // 6. Deposit.
  if (!row.remote_deposit_id) {
    // schemeId must be one the tenancy is actually eligible for — an arbitrary
    // id is rejected with "Scheme is not available for region".
    const schemes = await getAvailableDepositSchemes(ctx, row.remote_tenancy_id!, pid);
    const schemeId = schemes[0]?.id;
    if (schemeId == null) {
      throw new Error("mydeposits returned no available deposit schemes for this tenancy.");
    }
    const { depositId, status } = await createDeposit(
      ctx,
      { tenancyId: row.remote_tenancy_id!, schemeId, amount: contract.deposit },
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
    const details = await getPaymentDetails(ctx, row.remote_deposit_id!, pid).catch(() => null);
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
