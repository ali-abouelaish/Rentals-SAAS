"use server";

// Sending a generated tenancy agreement for e-signature.
//
// The document is the agency's own AST, generated exactly as it is today: their
// uploaded template with merge fields stamped in. The only difference is that
// signature fields placed on the same canvas are left blank and handed to
// BoldSign as form fields, so each party signs in the box the agency drew.
//
// Kept out of actions/contracts.ts so the contracts module doesn't pull the
// BoldSign client into every action import.

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { isBoldSignConfigured } from "@/lib/boldsign/config";
import type { SendForSignatureActionResult } from "@/lib/boldsign/types";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { sendForSignature } from "@/lib/boldsign/send";
import type { SignatureRequestSigner } from "@/lib/boldsign/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { groupSignatureFieldsByRole, type TemplateSignatureField } from "../lib/signatureFields";
import { SIGNER_ROLE_LABELS, type SignerRole } from "../templates/domain/types";

const CONTRACTS_BUCKET = "property_contracts";

export type ContractSigningState = {
  /** False when the agency has not subscribed to the e-signing integration. */
  entitled: boolean;
  status: string | null;
  sentAt: string | null;
  completedAt: string | null;
  isSandbox: boolean;
};

type Party = { name: string; email: string };

/**
 * Resolve who actually signs each role on this contract.
 *
 * Returns a message instead of a party when the record needed is missing, so
 * the caller can say precisely what to fix rather than letting BoldSign reject
 * the send for a blank email address.
 */
async function resolveParties(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  contract: { pm_tenant_id: string | null; unit_id: string | null }
): Promise<Partial<Record<SignerRole, Party | { error: string }>>> {
  const parties: Partial<Record<SignerRole, Party | { error: string }>> = {};

  // ── Tenant ───────────────────────────────────────────────────────
  if (contract.pm_tenant_id) {
    const { data: pmTenant } = await admin
      .from("pm_tenants")
      .select("full_name, email")
      .eq("id", contract.pm_tenant_id)
      .eq("tenant_id", tenantId)
      .maybeSingle<{ full_name: string | null; email: string | null }>();

    parties.tenant = pmTenant?.email?.trim()
      ? { name: pmTenant.full_name?.trim() || "Tenant", email: pmTenant.email.trim() }
      : { error: "the tenant has no email address on their record" };
  } else {
    parties.tenant = { error: "this contract has no tenant linked" };
  }

  // ── Landlord: unit → property → owner ────────────────────────────
  if (contract.unit_id) {
    const { data: unit } = await admin
      .from("units")
      .select("property_id")
      .eq("id", contract.unit_id)
      .maybeSingle<{ property_id: string | null }>();

    const { data: property } = unit?.property_id
      ? await admin
          .from("properties")
          .select("owner_landlord_id")
          .eq("id", unit.property_id)
          .maybeSingle<{ owner_landlord_id: string | null }>()
      : { data: null };

    const { data: owner } = property?.owner_landlord_id
      ? await admin
          .from("owner_landlords")
          .select("name, email")
          .eq("id", property.owner_landlord_id)
          .eq("tenant_id", tenantId)
          .maybeSingle<{ name: string | null; email: string | null }>()
      : { data: null };

    parties.landlord = owner?.email?.trim()
      ? { name: owner.name?.trim() || "Landlord", email: owner.email.trim() }
      : { error: "the property's landlord has no email address on their record" };
  } else {
    parties.landlord = { error: "this contract is not linked to a unit" };
  }

  // Guarantors are not modelled in Harbor Ops, so there is no contact to send
  // to. The editor doesn't offer the role; this catches a hand-edited template.
  parties.guarantor = {
    error: "guarantor signing is not supported yet — there is no guarantor record to send to",
  };

  return parties;
}

export async function sendContractForSignature(
  contractId: string
): Promise<SendForSignatureActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);

  // The paid gate. Checked here and not only in the UI: a server action is a
  // public endpoint, and the panel that hides the button is client code.
  if (!(await hasFeature("e_signing"))) {
    return {
      error:
        "E-signing isn't active on your account. Activate it under Settings → Integrations.",
    };
  }

  if (!isBoldSignConfigured()) {
    return { error: "E-signing is not configured. Add a BoldSign API key first." };
  }

  const admin = createSupabaseAdminClient();

  const { data: contract, error: contractError } = await admin
    .from("property_contracts")
    .select("id, template_id, generated_pdf_path, pm_tenant_id, unit_id")
    .eq("id", contractId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle<{
      id: string;
      template_id: string | null;
      generated_pdf_path: string | null;
      pm_tenant_id: string | null;
      unit_id: string | null;
    }>();

  if (contractError) return { error: contractError.message };
  if (!contract) return { error: "Contract not found." };

  if (!contract.generated_pdf_path || !contract.template_id) {
    return {
      error:
        "Generate the contract from a template first — there is no document to send for signature.",
    };
  }

  // ── The signature fields the agency placed on their template ─────
  const { data: templateFields, error: fieldsError } = await admin
    .from("contract_template_fields")
    .select("field_kind, signer_role, page_index, x, y, width, height")
    .eq("template_id", contract.template_id)
    .eq("tenant_id", profile.tenant_id)
    .neq("field_kind", "data")
    .returns<TemplateSignatureField[]>();

  if (fieldsError) return { error: fieldsError.message };

  const groups = groupSignatureFieldsByRole(templateFields ?? []);
  if (groups.length === 0) {
    return {
      error:
        "This template has no signature fields. Open it in the template editor and add a signature field for each party who signs.",
    };
  }

  // ── Who signs ────────────────────────────────────────────────────
  const parties = await resolveParties(admin, profile.tenant_id, contract);
  const signers: SignatureRequestSigner[] = [];

  for (const [index, group] of groups.entries()) {
    const party = parties[group.role];
    if (!party || "error" in party) {
      const reason = party && "error" in party ? party.error : "no record was found";
      return {
        error: `The template asks the ${SIGNER_ROLE_LABELS[group.role].toLowerCase()} to sign, but ${reason}.`,
      };
    }
    signers.push({
      name: party.name,
      email: party.email,
      // 1-based, in the order groupSignatureFieldsByRole returns: tenant first,
      // landlord countersigning last.
      order: index + 1,
      fields: group.fields,
    });
  }

  // ── The generated document ───────────────────────────────────────
  const { data: blob, error: downloadError } = await admin.storage
    .from(CONTRACTS_BUCKET)
    .download(contract.generated_pdf_path);

  if (downloadError || !blob) {
    return { error: downloadError?.message ?? "Could not read the generated contract." };
  }
  const pdf = Buffer.from(await blob.arrayBuffer());

  const result = await sendForSignature({
    tenantId: profile.tenant_id,
    entityType: "contract",
    entityId: contract.id,
    title: "Tenancy agreement",
    message: "Please review and sign your tenancy agreement.",
    pdf,
    fileName: "tenancy-agreement.pdf",
    sentBy: profile.id,
    signers,
    // Each party signs in turn — the landlord countersigns what the tenant has
    // already signed, rather than both signing a half-executed document.
    enableSigningOrder: signers.length > 1,
  });

  // `code` is propagated so the panel can tell an out-of-envelopes failure
  // apart from every other kind — it opens the purchase dialog rather than
  // showing a toast, because it is the one the user can fix in place.
  if (!result.ok) return { error: result.error, code: result.code };

  revalidatePath("/contracts");
  return { success: true, documentId: result.boldSignDocumentId };
}

export async function getContractSigningState(
  contractId: string
): Promise<ContractSigningState> {
  await requireRole([...ADMIN_ROLES]);

  const entitled = await hasFeature("e_signing");
  const empty: ContractSigningState = {
    entitled,
    status: null,
    sentAt: null,
    completedAt: null,
    isSandbox: false,
  };

  // Skip the query entirely when the agency can't use the feature — there is
  // nothing to show, and an unsubscribed agency shouldn't be paying a round
  // trip on every drawer open.
  if (!entitled) return empty;

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("boldsign_documents")
    .select("status, sent_at, completed_at, is_sandbox")
    .eq("entity_type", "contract")
    .eq("entity_id", contractId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      status: string;
      sent_at: string | null;
      completed_at: string | null;
      is_sandbox: boolean;
    }>();

  if (error || !data) return empty;
  return {
    entitled,
    status: data.status,
    sentAt: data.sent_at,
    completedAt: data.completed_at,
    isSandbox: data.is_sandbox,
  };
}
