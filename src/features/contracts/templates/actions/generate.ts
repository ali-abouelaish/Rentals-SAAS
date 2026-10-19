"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import {
  CONTRACTS_BUCKET,
  contractDocumentRoute,
  isMissingColumnError,
} from "@/lib/storage/contractDocuments";
import { generateContractSchema } from "../domain/schemas";
import { isTermManualKey } from "../domain/data-keys";
import { stampContractPdf, PdfTemplateError } from "../lib/pdf-stamp";
import { addDaysIso, type ResolverContext } from "../lib/resolver";
import {
  findGenerationTarget,
  generationLockReason,
  loadGenerationTarget,
} from "../lib/contract-lock";
import type {
  ActionResult,
  ContractTemplateField,
  ContractTerms,
  GenerationInputs,
} from "../domain/types";
import { TEMPLATE_SOURCE_BUCKET } from "../data/templates";

type GenerateInput = z.infer<typeof generateContractSchema>;
type Profile = Awaited<ReturnType<typeof requireRole>>;

export type GenerationResult = {
  contractId: string;
  /** Stable link to the contract's document (an app route, never an expiring URL). */
  documentUrl: string;
  /** Blank fields, unprintable characters, cut-short values — shown to the agent. */
  warnings: string[];
};

/** A failure whose message is written for the agent. */
class GenerationError extends Error {}

function toTermValue(key: string, terms: ContractTerms): string {
  switch (key) {
    case "start_date":
      return terms.start_date;
    case "expiry_date":
      return terms.expiry_date ?? "";
    case "rent_pcm":
      return String(terms.rent_pcm);
    case "deposit":
      return String(terms.deposit);
    default:
      return "";
  }
}

async function runGeneration(
  profile: Profile,
  input: GenerateInput,
  opts: { legacyRegenerate?: boolean } = {},
): Promise<GenerationResult> {
  const parsed = generateContractSchema.parse(input);
  const terms = parsed.terms;
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // ── Load template + fields ───────────────────────────────────────
  const { data: template } = await supabase
    .from("contract_templates")
    .select("id, source_pdf_path, tenant_id")
    .eq("id", parsed.templateId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!template) throw new GenerationError("That contract template no longer exists.");
  if (!template.source_pdf_path || template.source_pdf_path === "pending") {
    throw new GenerationError("This template's PDF didn't finish uploading. Upload the template again.");
  }

  const { data: fieldRows, error: fieldsError } = await supabase
    .from("contract_template_fields")
    .select("*")
    .eq("template_id", parsed.templateId)
    .eq("tenant_id", profile.tenant_id)
    .order("page_index", { ascending: true })
    .order("sort_order", { ascending: true });
  if (fieldsError) throw new Error(fieldsError.message);
  const fields = (fieldRows ?? []) as ContractTemplateField[];

  // ── Load booking + related rows ──────────────────────────────────
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parsed.bookingId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!booking) throw new GenerationError("Booking not found.");
  if (booking.status !== "approved") throw new GenerationError("Approve the booking before generating its contract.");
  if (!booking.unit_id) throw new GenerationError("This booking isn't linked to a room, so there's no tenancy to generate a contract for.");
  if (!booking.converted_pm_tenant_id) {
    throw new GenerationError("This booking hasn't been converted to a tenant yet, so there's no tenancy to generate a contract for.");
  }

  // ── Manual values ────────────────────────────────────────────────
  // Validated here as well as in the form: the PDF is a legal document, and a
  // blank where the agent meant to type something is not a cosmetic problem.
  // Term keys (start_date, rent_pcm, …) are always taken from the terms, so the
  // PDF and the contract record can never disagree.
  const manualValues: Record<string, string> = {};
  const missing: string[] = [];
  for (const f of fields) {
    if ((f.field_kind ?? "data") !== "data" || f.source !== "manual" || !f.manual_key) continue;
    const key = f.manual_key;
    if (key in manualValues) continue;
    if (isTermManualKey(key)) {
      manualValues[key] = toTermValue(key, terms);
      continue;
    }
    const value = (parsed.manualValues[key] ?? "").trim() || (f.manual_default ?? "").trim();
    if (!value) missing.push(f.label?.trim() || key);
    manualValues[key] = value;
  }
  if (missing.length > 0) {
    throw new GenerationError(
      opts.legacyRegenerate
        ? `This contract was generated before its template answers were saved, so they can't be re-used. Generate it again from the booking to re-enter: ${missing.join(", ")}.`
        : `Fill in the template fields before generating: ${missing.join(", ")}.`,
    );
  }

  // ── Resolve the contract to stamp ────────────────────────────────
  // Prefer an explicit id (the contract approveBooking just created); else the
  // tenancy's current contract; else create a draft so we can stamp against
  // its id. Never duplicate an existing live contract, and never overwrite one
  // that is in force or out for signature.
  let contractId: string | null = null;
  if (parsed.contractId) {
    const explicit = await loadGenerationTarget(supabase, profile.tenant_id, parsed.contractId);
    if (!explicit) throw new GenerationError("Contract not found.");
    // The id comes from the client; it must be this booking's tenancy.
    if (explicit.unit_id !== booking.unit_id || explicit.pm_tenant_id !== booking.converted_pm_tenant_id) {
      throw new GenerationError("That contract belongs to a different tenancy.");
    }
    const locked = await generationLockReason(supabase, explicit);
    if (locked) throw new GenerationError(locked);
    contractId = explicit.id;
  } else {
    const existing = await findGenerationTarget(
      supabase,
      profile.tenant_id,
      booking.unit_id,
      booking.converted_pm_tenant_id,
    );
    if (existing) {
      const locked = await generationLockReason(supabase, existing);
      if (locked) throw new GenerationError(locked);
      contractId = existing.id;
    }
  }

  if (!contractId) {
    const { data: created, error: createError } = await supabase
      .from("property_contracts")
      .insert({
        tenant_id: profile.tenant_id,
        unit_id: booking.unit_id,
        pm_tenant_id: booking.converted_pm_tenant_id,
        start_date: terms.start_date,
        expiry_date: terms.expiry_date,
        rent_pcm: terms.rent_pcm,
        deposit: terms.deposit,
        ...(terms.collection_date != null ? { collection_date: terms.collection_date } : {}),
        ...(terms.deposit_scheme ? { deposit_scheme: terms.deposit_scheme } : {}),
        deposit_protection_deadline: addDaysIso(terms.start_date, 30),
        status: "draft",
      })
      .select("id")
      .single();
    if (createError || !created) throw new Error(createError?.message ?? "Failed to create draft contract");
    contractId = created.id as string;
  }

  const [{ data: unit }, { data: agency }, { data: pmTenant }, { data: responses }, { data: contractRow }] =
    await Promise.all([
      supabase
        .from("units")
        .select("id, property_id, room_number, unit_type, min_price_pcm, max_price_pcm, deposit, holding_deposit")
        .eq("id", booking.unit_id)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle(),
      supabase.from("tenants").select("name").eq("id", profile.tenant_id).maybeSingle(),
      supabase
        .from("pm_tenants")
        .select("full_name, email, phone, current_address")
        .eq("id", booking.converted_pm_tenant_id)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle(),
      supabase
        .from("form_responses")
        .select("question_id, answer_text, answer_file_url, question:booking_form_questions(question_type)")
        .eq("booking_id", booking.id)
        .eq("tenant_id", profile.tenant_id),
      // The insert trigger assigns a per-tenancy standing_order_ref; read it back
      // so the template can stamp it (the tenant's rent standing-order reference).
      supabase
        .from("property_contracts")
        .select("standing_order_ref")
        .eq("id", contractId)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle(),
    ]);

  const { data: property } = unit?.property_id
    ? await supabase
        .from("properties")
        .select("id, name, address_line_1, address_line_2, postcode, area, property_type, bills, owner_landlord_id")
        .eq("id", unit.property_id)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle()
    : { data: null };

  const { data: landlord } = property?.owner_landlord_id
    ? await supabase
        .from("owner_landlords")
        .select("name, email, phone")
        .eq("id", property.owner_landlord_id)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle()
    : { data: null };

  const responseMap: ResolverContext["responses"] = new Map();
  for (const r of responses ?? []) {
    const qType = (r as { question?: { question_type?: string } | null }).question?.question_type ?? null;
    responseMap.set(r.question_id, {
      answer_text: r.answer_text ?? null,
      answer_file_url: r.answer_file_url ?? null,
      question_type: qType,
    });
  }

  // ── Download source PDF ──────────────────────────────────────────
  const { data: sourceBlob, error: dlError } = await admin.storage
    .from(TEMPLATE_SOURCE_BUCKET)
    .download(template.source_pdf_path);
  if (dlError || !sourceBlob) throw new GenerationError("The template's PDF couldn't be loaded. Try uploading the template again.");
  const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer());

  // ── Build resolver context ───────────────────────────────────────
  const ctx: ResolverContext = {
    booking: {
      id: booking.id,
      applicant_name: booking.applicant_name ?? null,
      applicant_email: booking.applicant_email ?? null,
      applicant_phone: booking.applicant_phone ?? null,
      submitted_at: booking.submitted_at ?? null,
    },
    unit: unit
      ? {
          id: unit.id,
          room_number: unit.room_number ?? null,
          unit_type: unit.unit_type ?? null,
          min_price_pcm: unit.min_price_pcm ?? null,
          max_price_pcm: unit.max_price_pcm ?? null,
          deposit: unit.deposit ?? null,
          holding_deposit: unit.holding_deposit ?? null,
        }
      : null,
    property: property
      ? {
          id: property.id,
          name: property.name ?? null,
          address_line_1: property.address_line_1 ?? null,
          address_line_2: property.address_line_2 ?? null,
          postcode: property.postcode ?? null,
          area: property.area ?? null,
          property_type: property.property_type ?? null,
          bills: property.bills ?? null,
        }
      : null,
    landlord: landlord
      ? { name: landlord.name ?? null, email: landlord.email ?? null, phone: landlord.phone ?? null }
      : null,
    agency: agency ? { name: agency.name ?? null } : null,
    pmTenant: pmTenant
      ? {
          full_name: pmTenant.full_name ?? null,
          email: pmTenant.email ?? null,
          phone: pmTenant.phone ?? null,
          current_address: pmTenant.current_address ?? null,
        }
      : null,
    responses: responseMap,
    manualValues,
    contractId,
    standingOrderRef: contractRow?.standing_order_ref ?? null,
    terms,
  };

  // ── Stamp the PDF ────────────────────────────────────────────────
  const stamped = await stampContractPdf({ sourceBytes, fields, context: ctx });

  // ── Upload generated PDF ─────────────────────────────────────────
  const generatedAt = new Date().toISOString();
  const outPath = `${profile.tenant_id}/${contractId}/generated/${template.id}-${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from(CONTRACTS_BUCKET)
    // pdf-lib's pdf.save() returns a Uint8Array; Supabase Storage in the Node
    // runtime must be handed a Buffer or it writes an empty/corrupt object
    // (upload "succeeds" but the PDF won't open). Mirrors the invoice flow.
    .upload(outPath, Buffer.from(stamped.bytes), { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  // ── Patch the contract ───────────────────────────────────────────
  // document_url is a stable app route that signs a fresh URL per click; a
  // stored signed URL stopped working an hour after generation.
  const documentUrl = contractDocumentRoute(contractId);
  const { error: patchError } = await supabase
    .from("property_contracts")
    .update({
      template_id: template.id,
      generated_from_booking_id: booking.id,
      generated_pdf_path: outPath,
      last_generated_at: generatedAt,
      document_url: documentUrl,
      start_date: terms.start_date,
      expiry_date: terms.expiry_date,
      rent_pcm: terms.rent_pcm,
      deposit: terms.deposit,
      ...(terms.collection_date != null ? { collection_date: terms.collection_date } : {}),
      ...(terms.deposit_scheme ? { deposit_scheme: terms.deposit_scheme } : {}),
      deposit_protection_deadline: addDaysIso(terms.start_date, 30),
      updated_at: generatedAt,
    })
    .eq("id", contractId)
    .eq("tenant_id", profile.tenant_id);
  if (patchError) throw new Error(patchError.message);

  // Columns from 20261016000001, written separately so generation keeps working
  // in the window between deploying this and applying that migration by hand.
  const inputs: GenerationInputs = {
    template_id: template.id,
    booking_id: booking.id,
    terms,
    manual_values: manualValues,
    generated_at: generatedAt,
  };
  const { error: extrasError } = await supabase
    .from("property_contracts")
    .update({
      document_bucket: CONTRACTS_BUCKET,
      document_path: outPath,
      generation_inputs: inputs,
      // Signature boxes are sent from this snapshot, so they land where they
      // were on the template this PDF was generated from.
      generated_fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        field_kind: f.field_kind ?? "data",
        signer_role: f.signer_role ?? null,
        source: f.source,
        data_key: f.data_key,
        manual_key: f.manual_key,
        question_id: f.question_id,
        page_index: f.page_index,
        x: Number(f.x),
        y: Number(f.y),
        width: Number(f.width),
        height: Number(f.height),
      })),
    })
    .eq("id", contractId)
    .eq("tenant_id", profile.tenant_id);
  if (extrasError) {
    if (isMissingColumnError(extrasError)) {
      console.warn("[contracts] generation inputs not saved — apply migration 20261016000001", extrasError.message);
    } else {
      console.error("[contracts] could not save generation inputs", { contractId, error: extrasError.message });
    }
  }

  // Starting a tenancy changes when the unit is next free: it becomes available
  // again on the contract's expiry date (rolling tenancy ⇒ unknown, cleared).
  await supabase
    .from("units")
    .update({ available_date: terms.expiry_date, updated_at: generatedAt })
    .eq("id", booking.unit_id)
    .eq("tenant_id", profile.tenant_id);

  revalidatePath("/properties");
  revalidatePath("/contracts");
  revalidatePath("/bookings");
  revalidatePath("/tenants");

  return { contractId, documentUrl, warnings: stamped.warnings };
}

function failureMessage(err: unknown): string {
  if (err instanceof GenerationError || err instanceof PdfTemplateError) return err.message;
  if (err instanceof ZodError) return err.issues[0]?.message ?? "Some contract details are invalid.";
  console.error("[contracts] generation failed", err);
  return "The contract couldn't be generated. Please try again, and contact support if it keeps happening.";
}

async function requireTemplatesFeature(): Promise<string | null> {
  return (await hasFeature("contract_templates"))
    ? null
    : "Contract templates aren't enabled on your account.";
}

export async function generateContractFromTemplate(
  input: GenerateInput,
): Promise<ActionResult<GenerationResult>> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const gate = await requireTemplatesFeature();
  if (gate) return { ok: false, error: gate };
  try {
    return { ok: true, ...(await runGeneration(profile, input)) };
  } catch (err) {
    return { ok: false, error: failureMessage(err) };
  }
}

export async function regenerateContractPdf(
  contractId: string,
): Promise<ActionResult<{ documentUrl: string; warnings: string[] }>> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const gate = await requireTemplatesFeature();
  if (gate) return { ok: false, error: gate };
  if (!z.string().uuid().safeParse(contractId).success) return { ok: false, error: "Contract not found." };

  const supabase = createSupabaseServerClient();
  // select("*") so a not-yet-applied generation_inputs column reads as absent
  // rather than failing the query.
  const { data: contract } = await supabase
    .from("property_contracts")
    .select("*")
    .eq("id", contractId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!contract) return { ok: false, error: "Contract not found." };
  if (!contract.template_id) return { ok: false, error: "This contract wasn't generated from a template, so there's nothing to regenerate." };
  if (!contract.generated_from_booking_id) {
    return { ok: false, error: "This contract has no source booking, so it can't be regenerated." };
  }
  if (!(contract.status === "draft" || contract.status === "sent")) {
    return { ok: false, error: "Only draft or sent contracts can be regenerated." };
  }

  const inputs = (contract.generation_inputs ?? null) as GenerationInputs | null;

  try {
    const result = await runGeneration(
      profile,
      {
        templateId: contract.template_id,
        bookingId: contract.generated_from_booking_id,
        // Always this contract — never "whichever contract the booking finds".
        contractId: contract.id,
        // The answers it was generated with; the contract's own terms, which
        // the agent may have edited since, are the source of truth for those.
        manualValues: inputs?.manual_values ?? {},
        terms: {
          start_date: contract.start_date,
          expiry_date: contract.expiry_date ?? null,
          rent_pcm: contract.rent_pcm,
          deposit: contract.deposit,
          collection_date: contract.collection_date ?? null,
          deposit_scheme: contract.deposit_scheme ?? null,
        },
      },
      { legacyRegenerate: !inputs },
    );
    return { ok: true, documentUrl: result.documentUrl, warnings: result.warnings };
  } catch (err) {
    return { ok: false, error: failureMessage(err) };
  }
}
