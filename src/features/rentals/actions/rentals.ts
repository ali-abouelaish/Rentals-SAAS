"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rentalCodeSchema, type RentalCodeFormValues } from "../domain/schemas";
import { requireUserProfile, requireRole } from "@/lib/auth/requireRole";

export async function createRentalCode(values: RentalCodeFormValues) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const payload = rentalCodeSchema.parse(values);
  let marketingAgentId =
    payload.marketing_agent_id && payload.marketing_agent_id.length > 0
      ? payload.marketing_agent_id
      : null;

  if (!marketingAgentId && payload.marketing_agent_name) {
    const { data: agentMatch } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("tenant_id", profile.tenant_id)
      .ilike("display_name", payload.marketing_agent_name)
      .limit(1)
      .single();
    marketingAgentId = agentMatch?.id ?? null;
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", payload.client_id)
    .single();
  if (clientError) throw new Error(clientError.message);

  const { data: codeData, error: codeError } = await supabase.rpc("next_rental_code", {
    p_tenant_id: profile.tenant_id
  });
  if (codeError) throw new Error(codeError.message);

  const { data, error } = await supabase
    .from("rental_codes")
    .insert({
      tenant_id: profile.tenant_id,
      code: codeData,
      date: new Date().toISOString(),
      consultation_fee_amount: payload.consultation_fee_amount,
      payment_method: payload.payment_method,
      property_address: payload.property_address,
      licensor_name: payload.licensor_name,
      assisted_by_agent_id: profile.id,
      marketing_agent_id: marketingAgentId,
      client_id: payload.client_id,
      landlord_id: null,
      status: "pending",
      client_snapshot: {
        full_name: client.full_name,
        phone: client.phone,
        nationality: client.nationality,
        dob: client.dob,
        company_or_university_name: client.company_or_university_name,
        occupation: client.occupation
      }
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "rental_created",
    entity_type: "rental",
    entity_id: data.id,
    metadata: { code: data.code }
  });

  revalidatePath("/rentals");
  return data;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function approveRentalCode(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);
  const rentalId = String(formData.get("rental_id") ?? "");
  const overrideValueRaw = formData.get("marketing_fee_override_gbp");
  const overrideReason = String(formData.get("marketing_fee_override_reason") ?? "");

  if (!rentalId) {
    throw new Error("Missing rental id.");
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rental_codes")
    .select("*")
    .eq("id", rentalId)
    .single();
  if (rentalError) throw new Error(rentalError.message);

  const { data: assistedAgent } = await supabase
    .from("agent_profiles")
    .select("commission_percent")
    .eq("user_id", rental.assisted_by_agent_id)
    .single();

  const { data: marketingAgent } = await supabase
    .from("agent_profiles")
    .select("marketing_fee")
    .eq("user_id", rental.marketing_agent_id)
    .single();

  const existingLedger = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("reference_type", "rental_code")
    .eq("reference_id", rental.id)
    .in("type", ["rental_net", "agent_earning", "marketing_fee"]);

  if (existingLedger.data && existingLedger.data.length > 0) {
    return { ok: true, status: "already_exists" };
  }

  const commissionPercent =
    assistedAgent?.commission_percent ?? 0;
  const paymentFee =
    rental.payment_method === "cash"
      ? 0
      : rental.payment_method === "transfer"
      ? 0.2
      : 0.0175;

  const base = roundMoney(rental.consultation_fee_amount * (1 - paymentFee));
  const assistedGross = roundMoney(base * (commissionPercent / 100));
  const defaultMarketingFee = marketingAgent?.marketing_fee ?? 0;
  const threshold = roundMoney(base * 0.45);

  const hasMarketingAgent =
    rental.marketing_agent_id &&
    rental.marketing_agent_id !== rental.assisted_by_agent_id;

  let marketingFeeValue = 0;
  let overrideValue: number | null = null;

  if (hasMarketingAgent) {
    const parsedOverride =
      typeof overrideValueRaw === "string" && overrideValueRaw.length > 0
        ? Number(overrideValueRaw)
        : null;
    if (defaultMarketingFee > threshold) {
      overrideValue = parsedOverride;
      if (overrideValue !== null && !Number.isNaN(overrideValue)) {
        if (overrideValue > defaultMarketingFee) {
          throw new Error("Override cannot exceed default marketing fee.");
        }
        marketingFeeValue = overrideValue;
      } else {
        marketingFeeValue = defaultMarketingFee;
      }
    } else {
      marketingFeeValue = defaultMarketingFee;
    }
  }

  const assistedNet = roundMoney(assistedGross - marketingFeeValue);
  if (assistedNet < 0) {
    throw new Error(
      "Marketing fee exceeds agent earnings. Enter a lower custom amount."
    );
  }

  if (overrideValue !== null && !Number.isNaN(overrideValue)) {
    await supabase
      .from("rental_codes")
      .update({
        marketing_fee_override_gbp: roundMoney(overrideValue),
        marketing_fee_override_reason: overrideReason || null
      })
      .eq("id", rental.id);
  }

  const { error: updateError } = await supabase
    .from("rental_codes")
    .update({ status: "approved" })
    .eq("id", rentalId);
  if (updateError) throw new Error(updateError.message);

  const ledgerRows = [
    {
      tenant_id: profile.tenant_id,
      type: "rental_net",
      reference_type: "rental_code",
      reference_id: rental.id,
      amount_gbp: base,
      agent_earning_gbp: 0,
      agent_id: null
    },
    {
      tenant_id: profile.tenant_id,
      type: "agent_earning",
      reference_type: "rental_code",
      reference_id: rental.id,
      amount_gbp: 0,
      agent_earning_gbp: assistedNet,
      agent_id: rental.assisted_by_agent_id
    }
  ];

  if (hasMarketingAgent && marketingFeeValue > 0) {
    ledgerRows.push({
      tenant_id: profile.tenant_id,
      type: "marketing_fee",
      reference_type: "rental_code",
      reference_id: rental.id,
      amount_gbp: 0,
      agent_earning_gbp: roundMoney(marketingFeeValue),
      agent_id: rental.marketing_agent_id
    });
  }

  const { error: ledgerError } = await supabase.from("ledger_entries").insert(ledgerRows);
  if (ledgerError) throw new Error(ledgerError.message);

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "rental_approved",
    entity_type: "rental",
    entity_id: rental.id,
    metadata: { code: rental.code }
  });

  revalidatePath(`/rentals/${rentalId}`);
  return { ok: true };
}

export async function updateRentalStatus(formData: FormData) {
  const supabase = createSupabaseServerClient();
  await requireRole(["admin"]);
  const rentalId = String(formData.get("rental_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!rentalId) throw new Error("Missing rental id.");
  if (!["paid", "refunded"].includes(status)) {
    throw new Error("Unsupported status update.");
  }

  const { error } = await supabase
    .from("rental_codes")
    .update({ status })
    .eq("id", rentalId);
  if (error) throw new Error(error.message);

  revalidatePath("/rentals");
  revalidatePath(`/rentals/${rentalId}`);
  return { ok: true };
}
