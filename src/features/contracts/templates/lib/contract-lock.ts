import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createSupabaseServerClient>;

export type GenerationTarget = {
  id: string;
  status: string;
  generated_pdf_path: string | null;
  start_date: string;
  expiry_date: string | null;
  rent_pcm: number;
  deposit: number;
};

const TARGET_COLUMNS = "id, status, generated_pdf_path, start_date, expiry_date, rent_pcm, deposit";

/**
 * The contract a booking's PDF is stamped onto: the most recent one for the
 * booking's unit + converted tenant that hasn't ended. Terminated contracts are
 * history and are never reused.
 */
export async function findGenerationTarget(
  supabase: Supabase,
  tenantId: string,
  unitId: string,
  pmTenantId: string,
): Promise<GenerationTarget | null> {
  const { data } = await supabase
    .from("property_contracts")
    .select(TARGET_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .eq("pm_tenant_id", pmTenantId)
    .neq("status", "terminated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GenerationTarget>();
  return data ?? null;
}

export async function loadGenerationTarget(
  supabase: Supabase,
  tenantId: string,
  contractId: string,
): Promise<(GenerationTarget & { unit_id: string; pm_tenant_id: string }) | null> {
  const { data } = await supabase
    .from("property_contracts")
    .select(`${TARGET_COLUMNS}, unit_id, pm_tenant_id`)
    .eq("tenant_id", tenantId)
    .eq("id", contractId)
    .maybeSingle<GenerationTarget & { unit_id: string; pm_tenant_id: string }>();
  return data ?? null;
}

/**
 * Why this contract must not be (re)stamped, or null when it may be.
 *
 * Generation rewrites the contract's terms and its document, so it is only
 * safe before the agreement is in force. In particular it must never replace
 * an executed e-signed agreement, or change the PDF while signers are signing
 * an older copy of it.
 */
export async function generationLockReason(
  supabase: Supabase,
  contract: { id: string; status: string; generated_pdf_path: string | null },
): Promise<string | null> {
  if (contract.status === "terminated") return "This contract has ended, so its document can't be changed.";
  if (contract.status === "notice_given") {
    return "Notice has been given on this tenancy, so its contract document can't be changed.";
  }

  // Ignore a query error: boldsign_documents may not exist on an install that
  // hasn't applied the e-signing migrations, and then nothing can be in flight.
  const { data: signing } = await supabase
    .from("boldsign_documents")
    .select("status")
    .eq("entity_type", "contract")
    .eq("entity_id", contract.id)
    .in("status", ["awaiting_signature", "partially_signed", "completed"])
    .order("sent_at", { ascending: false })
    .limit(1);
  const signingStatus = signing?.[0]?.status as string | undefined;

  if (signingStatus === "completed") {
    return "This contract has been e-signed. Its PDF is the executed agreement and can't be regenerated — create a new contract if the terms have changed.";
  }
  if (signingStatus) {
    return "This contract is out for e-signature. Wait for it to be signed, or revoke the request in BoldSign, before changing its document.";
  }

  if ((contract.status === "signed" || contract.status === "active") && contract.generated_pdf_path) {
    return "This tenancy is already signed and has its contract PDF. Regenerating would replace the agreement the tenant signed — create a new contract if the terms have changed.";
  }

  return null;
}
