"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { PdfTemplateError, readPdfPageMeta } from "../lib/pdf-stamp";
import {
  TEMPLATE_MAX_BYTES,
  TEMPLATE_MAX_PAGES,
  updateTemplateMetaSchema,
  uploadTemplateMetaSchema,
  uuidSchema,
} from "../domain/schemas";
import { isTermManualKey } from "../domain/data-keys";
import { TEMPLATE_SOURCE_BUCKET } from "../data/templates";
import type { ActionResult, FieldFormat, ManualFieldPrompt } from "../domain/types";

const FEATURE_OFF = "Contract templates aren't enabled on your account.";

async function ensureBucketExists(bucketName: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.getBucket(bucketName);
  if (error) {
    await admin.storage.createBucket(bucketName, { public: false });
  }
}

export async function uploadContractTemplate(formData: FormData): Promise<ActionResult<{ templateId: string }>> {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!(await hasFeature("contract_templates"))) return { ok: false, error: FEATURE_OFF };
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const meta = uploadTemplateMetaSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    portfolio_id: String(formData.get("portfolio_id") ?? ""),
  });
  if (!meta.success) return { ok: false, error: meta.error.issues[0]?.message ?? "Check the template details." };
  const { name } = meta.data;
  const description = meta.data.description || null;
  const portfolioId = meta.data.portfolio_id || null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF file to upload." };
  if (file.size > TEMPLATE_MAX_BYTES) {
    return { ok: false, error: `File too large (max ${TEMPLATE_MAX_BYTES / 1024 / 1024}MB).` };
  }
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Only PDF files are accepted." };
  }

  if (portfolioId) {
    // The FK only proves the portfolio exists; make sure it's this agency's.
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("id")
      .eq("id", portfolioId)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!portfolio) return { ok: false, error: "Choose a portfolio from the list." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let pageCount: number;
  let pageSizes: { width: number; height: number }[];
  try {
    ({ pageCount, pageSizes } = await readPdfPageMeta(bytes));
  } catch (err) {
    if (err instanceof PdfTemplateError) return { ok: false, error: err.message };
    console.error("[contract-templates] could not read uploaded PDF", err);
    return { ok: false, error: "That file couldn't be read as a PDF." };
  }
  if (pageCount > TEMPLATE_MAX_PAGES) {
    return { ok: false, error: `Templates may have at most ${TEMPLATE_MAX_PAGES} pages (this one has ${pageCount}).` };
  }

  await ensureBucketExists(TEMPLATE_SOURCE_BUCKET);

  // Pre-allocate id so we can use it in the storage path.
  const { data: inserted, error: insertError } = await supabase
    .from("contract_templates")
    .insert({
      tenant_id: profile.tenant_id,
      name,
      description,
      portfolio_id: portfolioId,
      source_pdf_path: "pending",
      page_count: pageCount,
      page_sizes: pageSizes,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("[contract-templates] insert failed", insertError);
    return { ok: false, error: "The template couldn't be saved. Please try again." };
  }

  const path = `${profile.tenant_id}/${inserted.id}/source.pdf`;
  const rollback = async () => {
    // No half-made template left behind with a "pending" PDF.
    await supabase.from("contract_templates").delete().eq("id", inserted.id).eq("tenant_id", profile.tenant_id);
    await admin.storage.from(TEMPLATE_SOURCE_BUCKET).remove([path]);
  };

  const { error: uploadError } = await admin.storage
    .from(TEMPLATE_SOURCE_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    await rollback();
    console.error("[contract-templates] upload failed", uploadError);
    return { ok: false, error: "The PDF couldn't be uploaded. Please try again." };
  }

  const { error: patchError } = await supabase
    .from("contract_templates")
    .update({ source_pdf_path: path })
    .eq("id", inserted.id)
    .eq("tenant_id", profile.tenant_id);
  if (patchError) {
    await rollback();
    console.error("[contract-templates] patch failed", patchError);
    return { ok: false, error: "The template couldn't be saved. Please try again." };
  }

  revalidatePath("/contracts/templates");
  return { ok: true, templateId: inserted.id };
}

export async function updateContractTemplateMeta(
  input: z.infer<typeof updateTemplateMetaSchema>,
): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!(await hasFeature("contract_templates"))) return { ok: false, error: FEATURE_OFF };
  const parsed = updateTemplateMetaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the template details." };
  const supabase = createSupabaseServerClient();

  if (parsed.data.portfolio_id) {
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("id")
      .eq("id", parsed.data.portfolio_id)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!portfolio) return { ok: false, error: "Choose a portfolio from the list." };
  }

  const { error } = await supabase
    .from("contract_templates")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      portfolio_id: parsed.data.portfolio_id,
      is_active: parsed.data.is_active,
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", profile.tenant_id);
  if (error) {
    console.error("[contract-templates] update failed", error);
    return { ok: false, error: "The template couldn't be updated. Please try again." };
  }

  revalidatePath("/contracts/templates");
  revalidatePath(`/contracts/templates/${parsed.data.id}`);
  return { ok: true };
}

export async function listContractTemplatesForBookingAction(
  portfolioId: string | null,
): Promise<{ id: string; name: string; page_count: number; portfolio_id: string | null }[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("contract_templates")
    .select("id, name, page_count, portfolio_id")
    .eq("tenant_id", profile.tenant_id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  // Validated before it goes into a PostgREST filter string.
  if (portfolioId && uuidSchema.safeParse(portfolioId).success) {
    query = query.or(`portfolio_id.is.null,portfolio_id.eq.${portfolioId}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * The manual fields the agent fills in at generation — one prompt per key, in
 * template order. Several boxes can share a key (the same name on every page);
 * they're asked once and print the same value. Term keys are left out: they're
 * filled from the contract terms so the PDF can't disagree with the record.
 */
export async function getTemplateManualFieldsAction(templateId: string): Promise<ManualFieldPrompt[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!uuidSchema.safeParse(templateId).success) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contract_template_fields")
    .select("label, manual_key, manual_default, format, sort_order, page_index")
    .eq("template_id", templateId)
    .eq("tenant_id", profile.tenant_id)
    .eq("source", "manual")
    .order("page_index", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const prompts = new Map<string, ManualFieldPrompt>();
  for (const row of data ?? []) {
    const key = row.manual_key?.trim();
    if (!key || isTermManualKey(key) || prompts.has(key)) continue;
    prompts.set(key, {
      key,
      label: row.label?.trim() || key,
      format: (row.format ?? "text") as FieldFormat,
      default_value: row.manual_default ?? null,
    });
  }
  return [...prompts.values()];
}

export async function deleteContractTemplate(templateId: string): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!uuidSchema.safeParse(templateId).success) return { ok: false, error: "Template not found." };
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const { data: template } = await supabase
    .from("contract_templates")
    .select("id, source_pdf_path")
    .eq("id", templateId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!template) return { ok: true };

  // Deleting would unlink the template from its contracts (FK set null), after
  // which they can no longer be regenerated or sent for e-signature.
  const { count } = await supabase
    .from("property_contracts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .eq("template_id", templateId);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `This template was used for ${count} contract${count === 1 ? "" : "s"}, which still need it to regenerate or send for signature. Mark it inactive instead — it will stop appearing when generating new contracts.`,
    };
  }

  // Fields cascade-delete via FK. Storage object removed separately.
  const { error } = await supabase
    .from("contract_templates")
    .delete()
    .eq("id", templateId)
    .eq("tenant_id", profile.tenant_id);
  if (error) {
    console.error("[contract-templates] delete failed", error);
    return { ok: false, error: "The template couldn't be deleted. Please try again." };
  }

  if (template.source_pdf_path && template.source_pdf_path !== "pending") {
    await admin.storage.from(TEMPLATE_SOURCE_BUCKET).remove([template.source_pdf_path]);
  }

  revalidatePath("/contracts/templates");
  return { ok: true };
}
