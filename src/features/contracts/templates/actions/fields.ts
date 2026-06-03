"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { saveTemplateFieldsSchema, templateFieldInputSchema } from "../domain/schemas";
import { isValidDataKey } from "../domain/data-keys";

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
    source: input.source,
    question_id: input.source === "booking_response" ? input.question_id : null,
    data_key: ["property", "unit", "landlord", "agency", "booking", "pm_tenant", "computed"].includes(input.source)
      ? input.data_key
      : null,
    manual_key: input.source === "manual" ? input.manual_key : null,
    manual_default: input.source === "manual" ? input.manual_default : null,
    format: input.format,
    font_size: input.font_size,
    font_weight: input.font_weight,
    text_align: input.text_align,
    truncate_overflow: input.truncate_overflow,
    ai_confidence: input.ai_confidence,
    sort_order: input.sort_order,
  };
}

export async function saveContractTemplateFields(input: z.infer<typeof saveTemplateFieldsSchema>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = saveTemplateFieldsSchema.parse(input);
  const supabase = createSupabaseServerClient();

  // Validate every data_key against the whitelist before writing.
  for (const f of parsed.fields) {
    if (["property", "unit", "landlord", "agency", "booking", "pm_tenant", "computed"].includes(f.source)) {
      if (!isValidDataKey(f.source, f.data_key)) {
        throw new Error(`Invalid data_key "${f.data_key}" for source "${f.source}"`);
      }
    }
  }

  // Confirm the template belongs to the tenant.
  const { data: template } = await supabase
    .from("contract_templates")
    .select("id, page_count, page_sizes")
    .eq("id", parsed.templateId)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (!template) throw new Error("Template not found");

  // Clamp fields to page bounds.
  const pageSizes = (template.page_sizes as { width: number; height: number }[]) ?? [];
  const clamped = parsed.fields.map((f) => {
    if (f.page_index >= template.page_count) {
      throw new Error(`Field references page ${f.page_index} but template has ${template.page_count} pages`);
    }
    const pageSize = pageSizes[f.page_index];
    if (pageSize) {
      const maxX = Math.max(0, pageSize.width - 1);
      const maxY = Math.max(0, pageSize.height - 1);
      return {
        ...f,
        x: Math.min(Math.max(0, f.x), maxX),
        y: Math.min(Math.max(0, f.y), maxY),
        width: Math.min(f.width, pageSize.width - Math.min(Math.max(0, f.x), maxX)),
        height: Math.min(f.height, pageSize.height - Math.min(Math.max(0, f.y), maxY)),
      };
    }
    return f;
  });

  // Full upsert via delete-then-insert. Fields per template are small (<100).
  const { error: deleteError } = await supabase
    .from("contract_template_fields")
    .delete()
    .eq("template_id", parsed.templateId)
    .eq("tenant_id", profile.tenant_id);
  if (deleteError) throw new Error(deleteError.message);

  if (clamped.length > 0) {
    const rows = clamped.map((f) => rowFromInput(f, profile.tenant_id, parsed.templateId));
    const { error: insertError } = await supabase.from("contract_template_fields").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath(`/contracts/templates/${parsed.templateId}`);
}
