"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { readPdfPageMeta } from "../lib/pdf-stamp";
import { updateTemplateMetaSchema } from "../domain/schemas";

const TEMPLATE_SOURCE_BUCKET = "contract_template_sources";
const MAX_PAGES = 20;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

async function ensureBucketExists(bucketName: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.getBucket(bucketName);
  if (error) {
    await admin.storage.createBucket(bucketName, { public: false });
  }
}

export async function uploadContractTemplate(formData: FormData): Promise<{ templateId: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const portfolioIdRaw = formData.get("portfolio_id");
  const portfolioId =
    typeof portfolioIdRaw === "string" && portfolioIdRaw.length > 0 ? portfolioIdRaw : null;
  const file = formData.get("file") as File | null;

  if (!name) throw new Error("Template name is required");
  if (!file) throw new Error("PDF file is required");
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024}MB)`);
  }
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are accepted");
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { pageCount, pageSizes } = await readPdfPageMeta(bytes);
  if (pageCount > MAX_PAGES) {
    throw new Error(`Templates may have at most ${MAX_PAGES} pages (uploaded ${pageCount}).`);
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
  if (insertError || !inserted) throw new Error(insertError?.message ?? "Failed to create template");

  const path = `${profile.tenant_id}/${inserted.id}/source.pdf`;
  const { error: uploadError } = await admin.storage
    .from(TEMPLATE_SOURCE_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    // Roll back the metadata row to avoid orphans.
    await supabase.from("contract_templates").delete().eq("id", inserted.id);
    throw new Error(uploadError.message);
  }

  const { error: patchError } = await supabase
    .from("contract_templates")
    .update({ source_pdf_path: path })
    .eq("id", inserted.id)
    .eq("tenant_id", profile.tenant_id);
  if (patchError) throw new Error(patchError.message);

  revalidatePath("/contracts/templates");
  return { templateId: inserted.id };
}

export async function updateContractTemplateMeta(input: z.infer<typeof updateTemplateMetaSchema>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = updateTemplateMetaSchema.parse(input);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("contract_templates")
    .update({
      name: parsed.name,
      description: parsed.description,
      portfolio_id: parsed.portfolio_id,
      is_active: parsed.is_active,
    })
    .eq("id", parsed.id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/contracts/templates");
  revalidatePath(`/contracts/templates/${parsed.id}`);
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

  if (portfolioId) {
    query = query.or(`portfolio_id.is.null,portfolio_id.eq.${portfolioId}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTemplateManualFieldsAction(templateId: string): Promise<
  { id: string; label: string; manual_key: string | null; manual_default: string | null; sort_order: number }[]
> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contract_template_fields")
    .select("id, label, manual_key, manual_default, sort_order")
    .eq("template_id", templateId)
    .eq("tenant_id", profile.tenant_id)
    .eq("source", "manual")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteContractTemplate(templateId: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const { data: template } = await supabase
    .from("contract_templates")
    .select("id, source_pdf_path")
    .eq("id", templateId)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (!template) return;

  // Fields cascade-delete via FK. Storage object removed separately.
  const { error } = await supabase
    .from("contract_templates")
    .delete()
    .eq("id", templateId)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  if (template.source_pdf_path && template.source_pdf_path !== "pending") {
    await admin.storage.from(TEMPLATE_SOURCE_BUCKET).remove([template.source_pdf_path]);
  }

  revalidatePath("/contracts/templates");
}
