"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rentalCodeSchema, type RentalCodeFormValues } from "../domain/schemas";
import { requireUserProfile, requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

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

  const adminClient = createSupabaseAdminClient();
  const { data: client, error: clientError } = await adminClient
    .from("clients")
    .select("*")
    .eq("id", payload.client_id)
    .eq("tenant_id", profile.tenant_id)
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
      status: "pending",
      client_snapshot: {
        first_name: client.first_name,
        last_name: client.last_name,
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

export async function createRentalCodeWithDocuments(formData: FormData): Promise<{
  ok: boolean;
  partial?: boolean;
  rentalCode?: any;
  error?: string;
}> {
  try {
    console.log("[rental] action called");
    const supabase = createSupabaseServerClient();
    const profile = await requireUserProfile();
    console.log("[rental] profile ok, user:", profile?.id, "tenant:", profile?.tenant_id);

    // Extract form values
    const clientId = String(formData.get("client_id") ?? "");
    const consultationFeeAmount = Number(formData.get("consultation_fee_amount") ?? 0);
    const paymentMethod = String(formData.get("payment_method") ?? "cash");
    const propertyAddress = String(formData.get("property_address") ?? "");
    const licensorName = String(formData.get("licensor_name") ?? "");
    const marketingAgentIdList = (formData.getAll("marketing_agent_id_list") as string[]).filter(Boolean);
    const assistedByOverride = String(formData.get("assisted_by_agent_id") ?? "");

    // Extract files
    const sourcingAgreementFiles = formData.getAll("sourcing_agreement") as File[];
    const paymentProofFiles = formData.getAll("payment_proof") as File[];
    const clientIdFiles = formData.getAll("client_id_doc") as File[];

    console.log("[rental] files - sourcing:", sourcingAgreementFiles.length, "payment:", paymentProofFiles.length, "clientId:", clientIdFiles.length);
    console.log("[rental] fields - clientId:", clientId, "fee:", consultationFeeAmount, "method:", paymentMethod);

    // Validate required documents
    if (sourcingAgreementFiles.length < 1) {
      return { ok: false, error: "Sourcing agreement is required (at least 1 image or PDF)." };
    }
    if (paymentProofFiles.length < 1) {
      return { ok: false, error: "Payment proof is required (at least 1 image or PDF)." };
    }
    if (clientIdFiles.length < 1) {
      return { ok: false, error: "Client ID is required (at least 1 image or PDF)." };
    }

    // Validate form data
    const payload = rentalCodeSchema.parse({
      client_id: clientId,
      consultation_fee_amount: consultationFeeAmount,
      payment_method: paymentMethod as "cash" | "transfer" | "card",
      property_address: propertyAddress,
      licensor_name: licensorName,
    });

    const resolvedMarketingAgentIds = [...new Set(marketingAgentIdList)];
    const marketingAgentId = resolvedMarketingAgentIds[0] ?? null;

    // Get client data — use admin client so agents can fetch any client in the
    // tenant (e.g. clients created by admin or assigned to another agent).
    // The rental insert itself is still RLS-enforced via assisted_by_agent_id.
    const adminClient = createSupabaseAdminClient();
    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("*")
      .eq("id", payload.client_id)
      .eq("tenant_id", profile.tenant_id)
      .single();
    if (clientError) return { ok: false, error: `Failed to load client: ${clientError.message}` };
    if (!client) return { ok: false, error: "Client not found or you do not have permission to access it." };

    // Always get next code from DB so we never insert a stale preview (e.g. CC0001 for new users).
    const { data: codeData, error: codeError } = await supabase.rpc("next_rental_code", {
      p_tenant_id: profile.tenant_id
    });
    if (codeError) return { ok: false, error: `Failed to generate rental code: ${codeError.message}` };
    const codeValue = String(codeData);

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
        assisted_by_agent_id: profile.role === "admin" && assistedByOverride ? assistedByOverride : profile.id,
        marketing_agent_id: marketingAgentId,
        client_id: payload.client_id,
        status: "pending",
        client_snapshot: {
          first_name: client.first_name,
          last_name: client.last_name,
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

    if (rentalError) return { ok: false, error: `Failed to insert rental record: ${rentalError.message}` };
    console.log("[rental] inserted ok, id:", rentalCode.id, "code:", rentalCode.code);

    // From this point on, the rental row exists in the DB. Ensure cache is
    // always invalidated (even if document upload fails) so the dashboard
    // reflects the new record regardless of downstream errors.
    try {
      // Insert junction table rows for all marketing agents
      if (resolvedMarketingAgentIds.length > 0) {
        const uniqueIds = [...new Set(resolvedMarketingAgentIds)];
        const { error: junctionError } = await supabase.from("rental_marketing_agents").insert(
          uniqueIds.map((agentId) => ({
            tenant_id: profile.tenant_id,
            rental_id: rentalCode.id,
            agent_id: agentId
          }))
        );
        if (junctionError) console.error("[rental] marketing agents insert failed:", junctionError.message);
      }

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
          if (uploadError) throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);

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
      console.log("[rental] documents uploaded ok for", rentalCode.code);

      const { error: activityError } = await supabase.from("activity_log").insert({
        tenant_id: profile.tenant_id,
        actor_user_id: profile.id,
        action: "rental_created",
        entity_type: "rental",
        entity_id: rentalCode.id,
        metadata: { code: rentalCode.code }
      });
      if (activityError) console.error("[rental] activity log insert failed:", activityError.message);

      // Mark client as registered after rental creation
      const { error: clientUpdateError } = await supabase
        .from("clients")
        .update({ status: "registered" })
        .eq("id", clientId);
      if (clientUpdateError) console.error("[rental] client status update failed:", clientUpdateError.message);
    } catch (docErr) {
      // Rental row was already committed — notify caller so the UI can
      // guide the user to re-upload documents instead of re-submitting.
      console.error("[rental] post-insert error for", rentalCode.code, docErr);
      return {
        ok: false,
        partial: true,
        rentalCode,
        error: docErr instanceof Error ? docErr.message : "Document upload failed",
      };
    } finally {
      // Always revalidate so the rental shows on the dashboard even if
      // document upload failed (the rental row is already committed).
      revalidatePath("/rentals");
      revalidatePath(`/clients/${clientId}`);
    }

    return { ok: true, rentalCode };
  } catch (err) {
    console.error("[createRentalCodeWithDocuments] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
  }
}

export async function updateRentalCode(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createSupabaseServerClient();
    const profile = await requireUserProfile();
    const rentalId = String(formData.get("rental_id") ?? "");
    if (!rentalId) return { ok: false, error: "Missing rental id." };

    const { data: rental, error: rentalError } = await supabase
      .from("rental_codes")
      .select("id, status, assisted_by_agent_id, tenant_id, property_address, licensor_name")
      .eq("id", rentalId)
      .single();
    if (rentalError) return { ok: false, error: rentalError.message };

    const isAdmin = profile.role.toLowerCase() === "admin";
    if (!isAdmin && rental.assisted_by_agent_id !== profile.id) {
      return { ok: false, error: "You do not have access to edit this rental." };
    }
    if (!isAdmin && rental.status !== "pending") {
      return { ok: false, error: "Only pending rentals can be edited." };
    }

    const marketingAgentIdList = (formData.getAll("marketing_agent_id_list") as string[]).filter(Boolean);
    const overrideValueRaw = formData.get("marketing_fee_override_gbp");
    const overrideReason = String(formData.get("marketing_fee_override_reason") ?? "");

    const feeAmount = Number(formData.get("consultation_fee_amount") ?? 0);
    const paymentMethod = String(formData.get("payment_method") ?? "cash");

    // Only update property_address / licensor_name if the form actually sent them
    const propertyAddressRaw = formData.get("property_address");
    const licensorNameRaw = formData.get("licensor_name");

    const resolvedMarketingAgentIds = [...new Set(marketingAgentIdList)];
    const marketingAgentId = resolvedMarketingAgentIds[0] ?? null;

    // Parse override if provided
    const parsedOverride =
      typeof overrideValueRaw === "string" && overrideValueRaw.length > 0
        ? Number(overrideValueRaw)
        : null;
    const hasValidOverride = parsedOverride !== null && !Number.isNaN(parsedOverride);

    const { error } = await supabase
      .from("rental_codes")
      .update({
        consultation_fee_amount: feeAmount,
        rental_amount_gbp: feeAmount,
        payment_method: paymentMethod,
        ...(propertyAddressRaw !== null ? { property_address: String(propertyAddressRaw) } : {}),
        ...(licensorNameRaw !== null ? { licensor_name: String(licensorNameRaw) } : {}),
        marketing_agent_id: marketingAgentId,
        ...(hasValidOverride
          ? {
              marketing_fee_override_gbp: roundMoney(parsedOverride!),
              marketing_fee_override_reason: overrideReason || null
            }
          : marketingAgentId === null
          ? { marketing_fee_override_gbp: null, marketing_fee_override_reason: null }
          : {})
      })
      .eq("id", rentalId);
    if (error) return { ok: false, error: error.message };

    // Sync junction table: delete old rows, insert new ones
    const { error: delError } = await supabase
      .from("rental_marketing_agents")
      .delete()
      .eq("rental_id", rentalId);
    if (delError) console.error("[rental] junction delete failed:", delError.message);

    if (resolvedMarketingAgentIds.length > 0) {
      const uniqueIds = [...new Set(resolvedMarketingAgentIds)];
      const { error: insError } = await supabase.from("rental_marketing_agents").insert(
        uniqueIds.map((agentId) => ({
          tenant_id: rental.tenant_id,
          rental_id: rentalId,
          agent_id: agentId
        }))
      );
      if (insError) console.error("[rental] junction insert failed:", insError.message);
    }

    revalidatePath("/earnings", "layout");
    revalidatePath("/me");
    revalidatePath(`/rentals/${rentalId}`);
    return { ok: true };
  } catch (err) {
    console.error("[updateRentalCode] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function deleteRentalCode(formData: FormData) {
  const supabase = createSupabaseServerClient();
  await requireRole([...ADMIN_ROLES]);
  const rentalId = String(formData.get("rental_id") ?? "");
  if (!rentalId) throw new Error("Missing rental id.");

  const { data: rental, error: rentalError } = await supabase
    .from("rental_codes")
    .select("id, status")
    .eq("id", rentalId)
    .single();
  if (rentalError) throw new Error(rentalError.message);

  if (rental.status !== "pending") {
    throw new Error("Only pending rentals can be deleted.");
  }

  const { error } = await supabase.from("rental_codes").delete().eq("id", rentalId);
  if (error) throw new Error(error.message);

  revalidatePath("/rentals");
  revalidatePath("/clients");
  redirect("/rentals");
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function approveRentalCode(formData: FormData): Promise<{ ok: boolean; error?: string; status?: string }> {
  try {
    const supabase = createSupabaseServerClient();
    const profile = await requireRole([...ADMIN_ROLES]);
    const rentalId = String(formData.get("rental_id") ?? "");
    const overrideValueRaw = formData.get("marketing_fee_override_gbp");
    const overrideReason = String(formData.get("marketing_fee_override_reason") ?? "");

    if (!rentalId) {
      return { ok: false, error: "Missing rental id." };
    }

    const { data: rental, error: rentalError } = await supabase
      .from("rental_codes")
      .select("*")
      .eq("id", rentalId)
      .single();
    if (rentalError) return { ok: false, error: rentalError.message };

    const { data: documentSets, error: docsError } = await supabase
      .from("document_sets")
      .select("set_type, documents(id)")
      .eq("rental_code_id", rentalId);
    if (docsError) return { ok: false, error: docsError.message };

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

    // Require at least 1 document in each set; allow any count >= 1 for sourcing agreements.
    const missing: string[] = [];
    if (counts.sourcing_agreement < 1) missing.push("sourcing agreement");
    if (counts.client_id < 1) missing.push("client ID");
    if (counts.payment_proof < 1) missing.push("payment proof");
    if (missing.length > 0) {
      const list =
        missing.length === 1
          ? missing[0]
          : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
      return { ok: false, error: `Missing required documents: ${list}.` };
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

    if (["approved", "paid"].includes(rental.status)) {
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
            return { ok: false, error: "Override cannot exceed default marketing fee." };
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
      return { ok: false, error: "Marketing fee exceeds agent earnings. Enter a lower custom amount." };
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
    if (updateError) return { ok: false, error: updateError.message };

    await supabase.from("activity_log").insert({
      tenant_id: profile.tenant_id,
      actor_user_id: profile.id,
      action: "rental_approved",
      entity_type: "rental",
      entity_id: rental.id,
      metadata: { code: rental.code }
    });

    revalidatePath(`/rentals/${rentalId}`);
    revalidatePath("/earnings", "layout");
    revalidatePath("/me");
    return { ok: true };
  } catch (err) {
    console.error("[approveRentalCode] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
  }
}

export async function updateRentalStatus(formData: FormData) {
  const supabase = createSupabaseServerClient();
  await requireRole([...ADMIN_ROLES]);
  const rentalId = String(formData.get("rental_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!rentalId) throw new Error("Missing rental id.");
  if (!["pending", "approved", "paid", "refunded", "need_more_info"].includes(status)) {
    throw new Error("Unsupported status update.");
  }

  const { error } = await supabase
    .from("rental_codes")
    .update({ status })
    .eq("id", rentalId);
  if (error) throw new Error(error.message);

  revalidatePath("/rentals");
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/earnings", "layout");
  revalidatePath("/me");
  return { ok: true };
}
