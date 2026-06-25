"use server";

import OpenAI from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { extractTextWithPositions, capItemsPerPage } from "../lib/pdf-extract";
import { DATA_KEY_OPTIONS, isValidDataKey } from "../domain/data-keys";
import { listBookingFormQuestionsForTemplate } from "../data/lookups";
import { getContractTemplate, TEMPLATE_SOURCE_BUCKET } from "../data/templates";
import type { AiFieldProposal, FieldSource } from "../domain/types";

let openaiClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set on the server.");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE_URL,
    });
  }
  return openaiClient;
}

type AllowedBinding =
  | { source: "booking_response"; question_id: string; label_hint: string }
  | { source: Exclude<FieldSource, "booking_response" | "manual">; data_key: string; label_hint: string }
  | { source: "manual"; manual_key: string; label_hint: string };

const MANUAL_BINDINGS: AllowedBinding[] = [
  { source: "manual", manual_key: "start_date", label_hint: "tenancy start date" },
  { source: "manual", manual_key: "expiry_date", label_hint: "tenancy expiry date" },
  { source: "manual", manual_key: "rent_pcm", label_hint: "monthly rent override" },
  { source: "manual", manual_key: "deposit", label_hint: "deposit amount override" },
  { source: "manual", manual_key: "signing_date", label_hint: "date the contract is signed" },
  { source: "manual", manual_key: "witness_name", label_hint: "name of witness" },
];

const SYSTEM_PROMPT = `You are a contract field detector for UK tenancy agreements. The user will give you positioned text extracted from a PDF (top-left origin, points) and a list of allowed bindings. For each blank or placeholder you find — underlines ("____"), tokens like "<<NAME>>", labelled blank boxes ("Tenant: ___"), date lines, signature blocks — emit one proposal that picks the most appropriate binding from the allowed list.

Binding guidance for common blanks:
- The applicant's / tenant's name, email or phone number → prefer the booking applicant fields: booking.applicant_name, booking.applicant_email, booking.applicant_phone. These are collected on every booking form and are always available at generation time, so prefer them over the equivalent pm_tenant.* fields unless the blank clearly refers to a different person.
- Property name/address, room or unit, rent, deposit → use the property.* and unit.* data keys.
- Values the agent fills in at signing (tenancy start date, signing date, witness name) → use the matching manual bindings.

If nothing obvious is a blank, do not emit anything. Return strictly JSON of the form {"proposals": [...]}. Each proposal has: page_index (0-based), x, y, width, height (PDF points, top-left origin), label (short human label), suggested_source (one of the allowed sources), suggested_key (the data_key OR manual_key — null if booking_response or unknown), suggested_question_id (the question id — null otherwise), and ai_confidence (0..1). Keep widths and heights to the visual extent of the blank, not the whole line.`;

export async function aiDetectFields(input: { templateId: string }): Promise<{ proposals: AiFieldProposal[] }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const template = await getContractTemplate(input.templateId);
  if (!template || template.tenant_id !== profile.tenant_id) {
    throw new Error("Template not found");
  }

  const admin = createSupabaseAdminClient();
  const { data: sourceBlob, error: dlError } = await admin.storage
    .from(TEMPLATE_SOURCE_BUCKET)
    .download(template.source_pdf_path);
  if (dlError || !sourceBlob) throw new Error(dlError?.message ?? "Failed to load template PDF");
  const bytes = new Uint8Array(await sourceBlob.arrayBuffer());

  let pages = await extractTextWithPositions(bytes);
  pages = capItemsPerPage(pages, 80);

  const questions = await listBookingFormQuestionsForTemplate(input.templateId);
  const allowedBindings: AllowedBinding[] = [
    ...DATA_KEY_OPTIONS.map<AllowedBinding>((opt) => ({
      source: opt.source as Exclude<FieldSource, "booking_response" | "manual">,
      data_key: opt.key,
      label_hint: opt.label,
    })),
    ...questions
      .filter((q) => q.question_type !== "file_upload" && q.question_type !== "info")
      .map<AllowedBinding>((q) => ({
        source: "booking_response",
        question_id: q.id,
        label_hint: q.question_text,
      })),
    ...MANUAL_BINDINGS,
  ];

  const userPayload = {
    page_count: template.page_count,
    pages: pages.map((p) => ({
      page_index: p.page_index,
      page_width: p.page_width,
      page_height: p.page_height,
      items: p.items.map((it) => ({ t: it.text, x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w), h: Math.round(it.h) })),
    })),
    allowed_bindings: allowedBindings,
  };

  const completion = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(userPayload) },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { proposals: [] };
  }

  const raw = (parsed as { proposals?: unknown[] }).proposals ?? [];
  const proposals: AiFieldProposal[] = [];

  const allowedQuestionIds = new Set(
    allowedBindings.filter((b) => b.source === "booking_response").map((b) => (b as { question_id: string }).question_id),
  );

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const pageIndex = Number(obj.page_index);
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= template.page_count) continue;

    const pageSize = template.page_sizes[pageIndex];
    if (!pageSize) continue;

    let x = Number(obj.x);
    let y = Number(obj.y);
    let w = Number(obj.width);
    let h = Number(obj.height);
    if (![x, y, w, h].every(Number.isFinite)) continue;
    if (w <= 0 || h <= 0) continue;

    // Clamp inside page bounds.
    x = Math.max(0, Math.min(x, pageSize.width - 1));
    y = Math.max(0, Math.min(y, pageSize.height - 1));
    w = Math.min(w, pageSize.width - x);
    h = Math.min(h, pageSize.height - y);
    if (w <= 0 || h <= 0) continue;

    const source = String(obj.suggested_source ?? "") as FieldSource;
    const suggestedKey = obj.suggested_key === null || obj.suggested_key === undefined ? null : String(obj.suggested_key);
    const suggestedQuestionId =
      obj.suggested_question_id === null || obj.suggested_question_id === undefined ? null : String(obj.suggested_question_id);

    // Validate binding shape.
    if (source === "booking_response") {
      if (!suggestedQuestionId || !allowedQuestionIds.has(suggestedQuestionId)) continue;
    } else if (source === "manual") {
      if (!suggestedKey) continue;
    } else if (["property", "unit", "landlord", "agency", "booking", "pm_tenant", "computed"].includes(source)) {
      if (!suggestedKey || !isValidDataKey(source, suggestedKey)) continue;
    } else {
      continue;
    }

    const label = typeof obj.label === "string" && obj.label.length > 0 ? String(obj.label).slice(0, 120) : "Field";
    const confidence = Number(obj.ai_confidence);

    proposals.push({
      page_index: pageIndex,
      x,
      y,
      width: w,
      height: h,
      label,
      suggested_source: source,
      suggested_key: suggestedKey,
      suggested_question_id: suggestedQuestionId,
      ai_confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
    });
  }

  return { proposals };
}
