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
      rental_amount_gbp: payload.consultation_fee_amount,
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

export async function createRentalCodeWithDocuments(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();

  // Extract form values
  const codeFromForm = String(formData.get("code") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const consultationFeeAmount = Number(formData.get("consultation_fee_amount") ?? 0);
  const paymentMethod = String(formData.get("payment_method") ?? "cash");
  const propertyAddress = String(formData.get("property_address") ?? "");
  const licensorName = String(formData.get("licensor_name") ?? "");
  const marketingAgentName = String(formData.get("marketing_agent_name") ?? "");

  // Extract files
  const sourcingAgreementFiles = formData.getAll("sourcing_agreement") as File[];
  const paymentProofFiles = formData.getAll("payment_proof") as File[];
  const clientIdFiles = formData.getAll("client_id_doc") as File[];

  // Validate required documents
  if (sourcingAgreementFiles.length < 1) {
    throw new Error("Sourcing agreement is required (at least 1 image or PDF).");
  }
  if (paymentProofFiles.length < 1) {
    throw new Error("Payment proof is required (at least 1 image or PDF).");
  }
  if (clientIdFiles.length < 1) {
    throw new Error("Client ID is required (at least 1 image or PDF).");
  }

  // Validate form data
  const payload = rentalCodeSchema.parse({
    client_id: clientId,
    consultation_fee_amount: consultationFeeAmount,
    payment_method: paymentMethod as "cash" | "transfer" | "card",
    property_address: propertyAddress,
    licensor_name: licensorName,
    marketing_agent_name: marketingAgentName || null
  });

  // Resolve marketing agent
  let marketingAgentId: string | null = null;
  if (marketingAgentName) {
    const { data: agentMatch } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("tenant_id", profile.tenant_id)
      .ilike("display_name", marketingAgentName)
      .limit(1)
      .single();
    marketingAgentId = agentMatch?.id ?? null;
  }

  // Get client data
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", payload.client_id)
    .single();
  if (clientError) throw new Error(clientError.message);

  // Determine rental code: prefer code provided from form (preview), otherwise generate
  let codeValue: string | null = codeFromForm || null;
  if (!codeValue) {
    const { data: codeData, error: codeError } = await supabase.rpc("next_rental_code", {
      p_tenant_id: profile.tenant_id
    });
    if (codeError) throw new Error(codeError.message);
    codeValue = String(codeData);
  }

  // Create rental code
  const { data: rentalCode, error: rentalError } = await supabase
    .from("rental_codes")
    .insert({
      tenant_id: profile.tenant_id,
      code: codeValue,
      date: new Date().toISOString(),
      consultation_fee_amount: payload.consultation_fee_amount,
      rental_amount_gbp: payload.consultation_fee_amount,
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

  if (rentalError) throw new Error(rentalError.message);

  // Upload documents
  const uploadDocumentSet = async (setType: "sourcing_agreement" | "client_id" | "payment_proof", files: File[]) => {
    const { data: setData, error: setError } = await supabase
      .from("document_sets")
      .insert({
        tenant_id: profile.tenant_id,
        rental_code_id: rentalCode.id,
        set_type: setType
      })
      .select("*")
      .single();
    if (setError) throw new Error(setError.message);

    for (const file of files) {
      const filePath = `${profile.tenant_id}/${rentalCode.id}/${setType}/${crypto.randomUUID()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("rental_docs")
        .upload(filePath, file);
      if (uploadError) throw new Error(uploadError.message);

      const { error: docError } = await supabase.from("documents").insert({
        tenant_id: profile.tenant_id,
        document_set_id: setData.id,
        file_path: filePath,
        file_name: file.name
      });
      if (docError) throw new Error(docError.message);
    }
  };

  await uploadDocumentSet("sourcing_agreement", sourcingAgreementFiles);
  await uploadDocumentSet("payment_proof", paymentProofFiles);
  await uploadDocumentSet("client_id", clientIdFiles);

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "rental_created",
    entity_type: "rental",
    entity_id: rentalCode.id,
    metadata: { code: rentalCode.code }
  });

  revalidatePath("/rentals");
  revalidatePath(`/clients/${clientId}`);

  // Mark client as registered after rental creation
  await supabase
    .from("clients")
    .update({ status: "registered" })
    .eq("id", clientId);

  return { ok: true, rentalCode };
}

export async function updateRentalCode(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const rentalId = String(formData.get("rental_id") ?? "");
  if (!rentalId) throw new Error("Missing rental id.");

  const { data: rental, error: rentalError } = await supabase
    .from("rental_codes")
    .select("id, status, assisted_by_agent_id, tenant_id")
    .eq("id", rentalId)
    .single();
  if (rentalError) throw new Error(rentalError.message);

  const isAdmin = profile.role.toLowerCase() === "admin";
  if (!isAdmin && rental.assisted_by_agent_id !== profile.id) {
    throw new Error("You do not have access to edit this rental.");
  }
  if (rental.status !== "pending") {
    throw new Error("Only pending rentals can be edited.");
  }

  const payload = rentalCodeSchema.parse({
    client_id: String(formData.get("client_id") ?? ""),
    consultation_fee_amount: Number(formData.get("consultation_fee_amount") ?? 0),
    payment_method: String(formData.get("payment_method") ?? "cash"),
    property_address: String(formData.get("property_address") ?? ""),
    licensor_name: String(formData.get("licensor_name") ?? ""),
    marketing_agent_id: String(formData.get("marketing_agent_id") ?? ""),
    marketing_agent_name: String(formData.get("marketing_agent_name") ?? "")
  });

  let marketingAgentId =
    payload.marketing_agent_id && payload.marketing_agent_id.length > 0
      ? payload.marketing_agent_id
      : null;

  if (!marketingAgentId && payload.marketing_agent_name) {
    const { data: agentMatch } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("tenant_id", rental.tenant_id)
      .ilike("display_name", payload.marketing_agent_name)
      .limit(1)
      .single();
    marketingAgentId = agentMatch?.id ?? null;
  }

  const { error } = await supabase
    .from("rental_codes")
    .update({
      consultation_fee_amount: payload.consultation_fee_amount,
      rental_amount_gbp: payload.consultation_fee_amount,
      payment_method: payload.payment_method,
      property_address: payload.property_address,
      licensor_name: payload.licensor_name,
      marketing_agent_id: marketingAgentId
    })
    .eq("id", rentalId);
  if (error) throw new Error(error.message);

  revalidatePath(`/rentals/${rentalId}`);
}

export async function deleteRentalCode(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const rentalId = String(formData.get("rental_id") ?? "");
  if (!rentalId) throw new Error("Missing rental id.");

  const { data: rental, error: rentalError } = await supabase
    .from("rental_codes")
    .select("id, status, assisted_by_agent_id")
    .eq("id", rentalId)
    .single();
  if (rentalError) throw new Error(rentalError.message);

  const isAdmin = profile.role.toLowerCase() === "admin";
  if (!isAdmin && rental.assisted_by_agent_id !== profile.id) {
    throw new Error("You do not have access to delete this rental.");
  }
  if (rental.status !== "pending") {
    throw new Error("Only pending rentals can be deleted.");
  }

  const { error } = await supabase.from("rental_codes").delete().eq("id", rentalId);
  if (error) throw new Error(error.message);

  revalidatePath("/rentals");
  revalidatePath(`/clients`);
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

  const { data: documentSets, error: docsError } = await supabase
    .from("document_sets")
    .select("set_type, documents(id)")
    .eq("rental_code_id", rentalId);
  if (docsError) throw new Error(docsError.message);

  const counts = (documentSets ?? []).reduce(
    (acc, set) => {
      const count = set.documents?.length ?? 0;
      acc[set.set_type as keyof typeof acc] = count;
      return acc;
    },
    {
      sourcing_agreement: 0,
      client_id: 0,
      payment_proof: 0
    }
  );

  const sourcingOk =
    counts.sourcing_agreement === 1 || counts.sourcing_agreement === 4;
  if (!sourcingOk || counts.client_id < 1 || counts.payment_proof < 1) {
    throw new Error(
      "Missing required documents: sourcing agreement, client ID, and payment proof."
    );
  }

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
