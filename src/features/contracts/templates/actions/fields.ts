"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { saveTemplateFieldsSchema, templateFieldInputSchema } from "../domain/schemas";
import { isDataKeySource, isValidDataKey } from "../domain/data-keys";
import type { ActionResult } from "../domain/types";

type FieldInput = z.infer<typeof templateFieldInputSchema>;

function rowFromInput(input: FieldInput, tenantId: string, templateId: string) {
  // Re-clamp coords to ensure non-negative; UI does this too but defence-in-depth.
  return {
    tenant_id: tenantId,
    template_id: templateId,
    label: input.label,
    page_index: input.page_index,
    x: Math.max(0, input.x),
    y: Math.max(0, input.y),
    width: Math.max(1, input.width),
    height: Math.max(1, input.height),
    field_kind: input.field_kind,
    signer_role: input.field_kind === "data" ? null : input.signer_role,
    // An e-signature field binds to no data, so every binding column is cleared
    // rather than carrying over whatever the field held before it was converted.
    source: input.field_kind === "data" ? input.source : null,
    question_id:
      input.field_kind === "data" && input.source === "booking_response"
        ? input.question_id
        : null,
    data_key: input.field_kind === "data" && isDataKeySource(input.source) ? input.data_key : null,
    manual_key: input.field_kind === "data" && input.source === "manual" ? input.manual_key?.trim() ?? null : null,
    manual_default:
      input.field_kind === "data" && input.source === "manual" ? input.manual_default : null,
    format: input.format,
    font_size: input.font_size,
    font_weight: input.font_weight,
    text_align: input.text_align,
    truncate_overflow: input.truncate_overflow,
    ai_confidence: input.ai_confidence,
    sort_order: input.sort_order,
  };
}

export async function saveContractTemplateFields(
  input: z.infer<typeof saveTemplateFieldsSchema>,
): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!(await hasFeature("contract_templates"))) {
    return { ok: false, error: "Contract templates aren't enabled on your account." };
  }
  const result = saveTemplateFieldsSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const index = typeof issue?.path[1] === "number" ? issue.path[1] : null;
    const label = index !== null ? input.fields[index]?.label : null;
    return { ok: false, error: `${label ? `"${label}": ` : ""}${issue?.message ?? "Some fields are invalid."}` };
  }
  const parsed = result.data;
  const supabase = createSupabaseServerClient();

  // Validate every data_key against the whitelist before writing.
  for (const f of parsed.fields) {
    if (f.field_kind !== "data" || f.source === null) continue;
    if (isDataKeySource(f.source) && !isValidDataKey(f.source, f.data_key)) {
      return { ok: false, error: `"${f.label}" points at a field that doesn't exist (${f.data_key}). Pick it again.` };
    }
  }

  // Confirm the template belongs to the tenant.
  const { data: template } = await supabase
    .from("contract_templates")
    .select("id, page_count, page_sizes")
    .eq("id", parsed.templateId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!template) return { ok: false, error: "Template not found." };

  // Clamp fields to page bounds.
  const pageSizes = (template.page_sizes as { width: number; height: number }[]) ?? [];
  for (const f of parsed.fields) {
    if (f.page_index >= template.page_count) {
      return { ok: false, error: `"${f.label}" is on page ${f.page_index + 1}, but the template has ${template.page_count} pages.` };
    }
  }
  const clamped = parsed.fields.map((f) => {
    const pageSize = pageSizes[f.page_index];
    if (!pageSize) return f;
    const maxX = Math.max(0, pageSize.width - 1);
    const maxY = Math.max(0, pageSize.height - 1);
    const x = Math.min(Math.max(0, f.x), maxX);
    const y = Math.min(Math.max(0, f.y), maxY);
    return {
      ...f,
      x,
      y,
      width: Math.min(f.width, pageSize.width - x),
      height: Math.min(f.height, pageSize.height - y),
    };
  });

  // Replace the field set without a window in which it is lost. Insert the new
  // rows first, then delete everything older than them: if the insert fails the
  // old fields are untouched, and if the delete fails the next save sweeps the
  // leftovers (it deletes everything older than ITS rows). The previous
  // delete-then-insert wiped a template whenever the insert was rejected.
  let cutoff: string | null = null;
  if (clamped.length > 0) {
    const rows = clamped.map((f) => rowFromInput(f, profile.tenant_id, parsed.templateId));
    const { data: inserted, error: insertError } = await supabase
      .from("contract_template_fields")
      .insert(rows)
      .select("created_at");
    if (insertError) {
      console.error("[contract-templates] field insert failed", insertError);
      return { ok: false, error: "The fields couldn't be saved — your previous version is unchanged. Please try again." };
    }
    cutoff = (inserted ?? []).map((r) => r.created_at as string).sort()[0] ?? null;
    if (!cutoff) return { ok: false, error: "The fields couldn't be saved. Please try again." };
  }

  let del = supabase
    .from("contract_template_fields")
    .delete()
    .eq("template_id", parsed.templateId)
    .eq("tenant_id", profile.tenant_id);
  if (cutoff) del = del.lt("created_at", cutoff);
  const { error: deleteError } = await del;
  if (deleteError) {
    console.error("[contract-templates] old field cleanup failed", deleteError);
    return { ok: false, error: "The fields were saved, but older copies couldn't be cleared. Save again to tidy up." };
  }

  revalidatePath(`/contracts/templates/${parsed.templateId}`);
  return { ok: true };
}
