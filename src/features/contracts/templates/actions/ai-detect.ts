"use server";

import OpenAI from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { rateLimitCheck } from "@/features/property-shares/lib/rate-limit";
import { extractTextWithPositions, capItemsPerPage } from "../lib/pdf-extract";
import { DATA_KEY_OPTIONS, isDataKeySource, isValidDataKey } from "../domain/data-keys";
import { listBookingFormQuestionsForTemplate } from "../data/lookups";
import { getContractTemplate, TEMPLATE_SOURCE_BUCKET } from "../data/templates";
import type { ActionResult, AiFieldProposal, FieldSource } from "../domain/types";

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

// The tenancy's own terms (start, end, rent, deposit) are contract.* data keys,
// filled from what the agent enters at generation — not manual keys, which made
// the agent type the start date twice and let the PDF disagree with the record.
const MANUAL_BINDINGS: AllowedBinding[] = [
  { source: "manual", manual_key: "signing_date", label_hint: "date the contract is signed" },
  { source: "manual", manual_key: "witness_name", label_hint: "name of witness" },
];

// Each detection is a paid model call over the whole document.
const AI_DETECT_WINDOW_MS = 60 * 60 * 1000;
const AI_DETECT_MAX_PER_WINDOW = 20;

const SYSTEM_PROMPT = `You are a contract field detector for UK tenancy agreements. The user will give you positioned text extracted from a PDF (top-left origin, points) and a list of allowed bindings. For each blank or placeholder you find — underlines ("____"), tokens like "<<NAME>>", labelled blank boxes ("Tenant: ___"), date lines — emit one proposal that picks the most appropriate binding from the allowed list.

Binding guidance for common blanks:
- The applicant's / tenant's name, email or phone number → prefer the booking applicant fields: booking.applicant_name, booking.applicant_email, booking.applicant_phone. These are collected on every booking form and are always available at generation time, so prefer them over the equivalent pm_tenant.* fields unless the blank clearly refers to a different person.
- The agreed tenancy terms → use the contract.* data keys: contract.start_date, contract.expiry_date (end of the term), contract.rent_pcm (the monthly rent), contract.deposit (the deposit amount), contract.collection_date (the day of the month rent is due), contract.deposit_scheme. Never use unit.min_price_pcm, unit.max_price_pcm or unit.deposit for the rent or deposit — those are listing prices, not the agreed terms.
- Property name/address and room or unit → use the property.* and unit.* data keys.
- Values the agent fills in at signing (signing date, witness name) → use the matching manual bindings.
- Do NOT propose signature, initials or "signed by" lines — those are placed separately as e-signature fields.

If nothing obvious is a blank, do not emit anything. Return strictly JSON of the form {"proposals": [...]}. Each proposal has: page_index (0-based), x, y, width, height (PDF points, top-left origin), label (short human label), suggested_source (one of the allowed sources), suggested_key (the data_key OR manual_key — null if booking_response or unknown), suggested_question_id (the question id — null otherwise), and ai_confidence (0..1). Keep widths and heights to the visual extent of the blank, not the whole line.`;

export async function aiDetectFields(input: {
  templateId: string;
}): Promise<ActionResult<{ proposals: AiFieldProposal[] }>> {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!(await hasFeature("contract_templates"))) {
    return { ok: false, error: "Contract templates aren't enabled on your account." };
  }
  const limit = rateLimitCheck(`contract-ai-detect:${profile.tenant_id}`, AI_DETECT_WINDOW_MS, AI_DETECT_MAX_PER_WINDOW);
  if (!limit.allowed) {
    return {
      ok: false,
      error: `AI suggestions are limited to ${AI_DETECT_MAX_PER_WINDOW} an hour. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes, or mark fields by hand.`,
    };
  }

  try {
    return { ok: true, proposals: await detect(profile.tenant_id, input.templateId) };
  } catch (err) {
    console.error("[contract-templates] AI detection failed", err);
    return { ok: false, error: "AI suggestions are unavailable right now. Mark fields by dragging on the PDF." };
  }
}

async function detect(tenantId: string, templateId: string): Promise<AiFieldProposal[]> {
  const template = await getContractTemplate(templateId);
  if (!template || template.tenant_id !== tenantId) {
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

  const questions = await listBookingFormQuestionsForTemplate(templateId);
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
    return [];
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
    } else if (isDataKeySource(source)) {
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

  return proposals;
}
