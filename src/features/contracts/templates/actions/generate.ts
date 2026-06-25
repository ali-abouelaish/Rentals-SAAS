"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { generateContractSchema } from "../domain/schemas";
import { stampContractPdf } from "../lib/pdf-stamp";
import type { ResolverContext } from "../lib/resolver";
import type { ContractTemplateField } from "../domain/types";
import { TEMPLATE_SOURCE_BUCKET } from "../data/templates";

const CONTRACTS_BUCKET = "property_contracts";
const SIGNED_URL_TTL = 60 * 60;

function addDays(yyyy_mm_dd: string, days: number): string {
  const d = new Date(yyyy_mm_dd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type GenerateInput = z.infer<typeof generateContractSchema>;

export async function generateContractFromTemplate(
  input: GenerateInput,
): Promise<{ contractId: string; signedUrl: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = generateContractSchema.parse(input);
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // ── Load template + fields ───────────────────────────────────────
  const { data: template, error: templateError } = await supabase
    .from("contract_templates")
    .select("id, source_pdf_path, tenant_id")
    .eq("id", parsed.templateId)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (templateError || !template) throw new Error(templateError?.message ?? "Template not found");

  const { data: fields, error: fieldsError } = await supabase
    .from("contract_template_fields")
    .select("*")
    .eq("template_id", parsed.templateId)
    .eq("tenant_id", profile.tenant_id)
    .order("page_index", { ascending: true })
    .order("sort_order", { ascending: true });
  if (fieldsError) throw new Error(fieldsError.message);

  // ── Load booking + related rows ──────────────────────────────────
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parsed.bookingId)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (bookingError || !booking) throw new Error(bookingError?.message ?? "Booking not found");
  if (booking.status !== "approved") throw new Error("Booking must be approved before generating a contract");
  if (!booking.unit_id) throw new Error("Booking has no linked unit — cannot generate contract");
  if (!booking.converted_pm_tenant_id) throw new Error("Booking has no converted tenant — cannot generate contract");

  const { data: unit } = await supabase
    .from("units")
    .select("id, property_id, room_number, unit_type, min_price_pcm, max_price_pcm, deposit, holding_deposit")
    .eq("id", booking.unit_id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  const { data: property } = unit?.property_id
    ? await supabase
        .from("properties")
        .select("id, name, address_line_1, address_line_2, postcode, area, property_type, bills, owner_landlord_id")
        .eq("id", unit.property_id)
        .eq("tenant_id", profile.tenant_id)
        .single()
    : { data: null };

  const { data: landlord } = property?.owner_landlord_id
    ? await supabase
        .from("owner_landlords")
        .select("name, email, phone")
        .eq("id", property.owner_landlord_id)
        .eq("tenant_id", profile.tenant_id)
        .single()
    : { data: null };

  const { data: agency } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", profile.tenant_id)
    .single();

  const { data: pmTenant } = await supabase
    .from("pm_tenants")
    .select("full_name, email, phone, current_address")
    .eq("id", booking.converted_pm_tenant_id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  const { data: responses } = await supabase
    .from("form_responses")
    .select("question_id, answer_text, answer_file_url, question:booking_form_questions(question_type)")
    .eq("booking_id", booking.id)
    .eq("tenant_id", profile.tenant_id);

  const responseMap: ResolverContext["responses"] = new Map();
  for (const r of responses ?? []) {
    const qType = (r as { question?: { question_type?: string } | null }).question?.question_type ?? null;
    responseMap.set(r.question_id, {
      answer_text: r.answer_text ?? null,
      answer_file_url: r.answer_file_url ?? null,
      question_type: qType,
    });
  }

  // ── Find existing draft contract (created by approveBooking) ────
  const { data: existingDraft } = await supabase
    .from("property_contracts")
    .select("id")
    .eq("tenant_id", profile.tenant_id)
    .eq("unit_id", booking.unit_id)
    .eq("pm_tenant_id", booking.converted_pm_tenant_id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let contractId = existingDraft?.id ?? null;

  // If no draft exists yet, create one in-place so we can stamp against its id.
  if (!contractId) {
    const { data: created, error: createError } = await supabase
      .from("property_contracts")
      .insert({
        tenant_id: profile.tenant_id,
        unit_id: booking.unit_id,
        pm_tenant_id: booking.converted_pm_tenant_id,
        start_date: parsed.contractDefaults.start_date,
        rent_pcm: parsed.contractDefaults.rent_pcm,
        deposit: parsed.contractDefaults.deposit,
        status: "draft",
      })
      .select("id")
      .single();
    if (createError || !created) throw new Error(createError?.message ?? "Failed to create draft contract");
    contractId = created.id;
  }

  // ── Download source PDF ──────────────────────────────────────────
  const { data: sourceBlob, error: dlError } = await admin.storage
    .from(TEMPLATE_SOURCE_BUCKET)
    .download(template.source_pdf_path);
  if (dlError || !sourceBlob) throw new Error(dlError?.message ?? "Failed to load template PDF");
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
    manualValues: parsed.manualValues,
    contractId,
    startDate: parsed.contractDefaults.start_date,
  };

  // ── Stamp the PDF ────────────────────────────────────────────────
  const stamped = await stampContractPdf({
    sourceBytes,
    fields: (fields ?? []) as ContractTemplateField[],
    context: ctx,
  });

  // ── Upload generated PDF ─────────────────────────────────────────
  const ts = Date.now();
  const outPath = `${profile.tenant_id}/${contractId}/generated/${template.id}-${ts}.pdf`;
  const { error: uploadError } = await admin.storage
    .from(CONTRACTS_BUCKET)
    .upload(outPath, stamped, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data: signed, error: signError } = await admin.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(outPath, SIGNED_URL_TTL);
  if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? "Failed to sign generated PDF URL");

  // ── Patch the draft contract ─────────────────────────────────────
  const protectionDeadline = addDays(parsed.contractDefaults.start_date, 30);

  const { error: patchError } = await supabase
    .from("property_contracts")
    .update({
      template_id: template.id,
      generated_from_booking_id: booking.id,
      generated_pdf_path: outPath,
      last_generated_at: new Date().toISOString(),
      document_url: signed.signedUrl,
      start_date: parsed.contractDefaults.start_date,
      rent_pcm: parsed.contractDefaults.rent_pcm,
      deposit: parsed.contractDefaults.deposit,
      collection_date: parsed.contractDefaults.collection_date ?? undefined,
      deposit_scheme: parsed.contractDefaults.deposit_scheme ?? undefined,
      deposit_protection_deadline: protectionDeadline,
    })
    .eq("id", contractId)
    .eq("tenant_id", profile.tenant_id);
  if (patchError) throw new Error(patchError.message);

  revalidatePath("/contracts");
  revalidatePath("/bookings");

  return { contractId, signedUrl: signed.signedUrl };
}

export async function regenerateContractPdf(contractId: string): Promise<{ signedUrl: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: contract, error: cErr } = await supabase
    .from("property_contracts")
    .select("id, template_id, generated_from_booking_id, status, start_date, rent_pcm, deposit, collection_date, deposit_scheme")
    .eq("id", contractId)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (cErr || !contract) throw new Error(cErr?.message ?? "Contract not found");
  if (!contract.template_id) throw new Error("Contract has no template — cannot regenerate");
  if (!contract.generated_from_booking_id) throw new Error("Contract has no source booking — cannot regenerate");
  if (!(contract.status === "draft" || contract.status === "sent")) {
    throw new Error("Only draft or sent contracts can be regenerated");
  }

  const result = await generateContractFromTemplate({
    templateId: contract.template_id,
    bookingId: contract.generated_from_booking_id,
    manualValues: {},
    contractDefaults: {
      start_date: contract.start_date,
      rent_pcm: contract.rent_pcm,
      deposit: contract.deposit,
      collection_date: contract.collection_date ?? undefined,
      deposit_scheme: contract.deposit_scheme ?? undefined,
    },
  });

  return { signedUrl: result.signedUrl };
}
