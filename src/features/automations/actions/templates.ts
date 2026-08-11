"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { DEFAULT_TEMPLATES } from "../domain/defaultTemplates";
import { TEMPLATE_ENTITY_TYPES, type MessageEntityType } from "../domain/types";
import { buildMergeContext, sharedContext } from "../lib/mergeContext";
import { renderTemplate } from "../lib/render";
import { getTenantMessaging } from "../lib/settings";

type Result = { ok: true } | { ok: false; error: string };

const updateTemplateInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120, "Max 120 characters"),
  subject: z.string().trim().max(200, "Max 200 characters").nullable(),
  body: z.string().trim().min(1, "Body is required").max(10000, "Max 10,000 characters"),
});

export async function updateTemplate(
  input: z.infer<typeof updateTemplateInput>
): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = updateTemplateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template." };
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("message_templates")
    .update({
      name: parsed.data.name,
      subject: parsed.data.subject,
      body: parsed.data.body,
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/automations/templates");
  return { ok: true };
}

/** Restore a seeded template's subject/body/name to the code default. */
export async function resetTemplate(id: string): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("message_templates")
    .select("id, key, channel")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Template not found." };

  const def = DEFAULT_TEMPLATES.find(
    (t) => t.key === row.key && t.channel === row.channel
  );
  if (!def) return { ok: false, error: "This template has no built-in default." };

  const { error: updErr } = await admin
    .from("message_templates")
    .update({ name: def.name, subject: def.subject, body: def.body })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };
  revalidatePath("/automations/templates");
  return { ok: true };
}

const createTemplateInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Max 120 characters"),
  channel: z.enum(["email", "sms", "in_app"]),
  entityType: z.enum(TEMPLATE_ENTITY_TYPES),
  subject: z.string().trim().max(200, "Max 200 characters").nullable(),
  body: z.string().trim().min(1, "Body is required").max(10000, "Max 10,000 characters"),
});

export async function createTemplate(
  input: z.infer<typeof createTemplateInput>
): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = createTemplateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template." };
  }
  const slug = parsed.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const key = `${slug || "custom"}_${Math.random().toString(36).slice(2, 7)}`;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("message_templates").insert({
    tenant_id: profile.tenant_id,
    key,
    name: parsed.data.name,
    channel: parsed.data.channel,
    entity_type: parsed.data.entityType,
    subject: parsed.data.subject,
    body: parsed.data.body,
    is_default: false,
    created_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/automations/templates");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("message_templates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "This template is used by an automation rule — change the rule first.",
      };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/automations/templates");
  return { ok: true };
}

export type TemplatePreviewResult =
  | { ok: true; subject: string | null; body: string; entityLabel: string; unknownKeys: string[] }
  | { ok: false; error: string };

const PREVIEW_TABLES: Record<MessageEntityType, { table: string; label: string }> = {
  tenancy: { table: "property_contracts", label: "latest tenancy" },
  pm_tenant: { table: "pm_tenants", label: "latest tenant" },
  property: { table: "properties", label: "latest property" },
  unit: { table: "units", label: "latest unit" },
  works_order: { table: "maintenance_jobs", label: "latest works order" },
  owner: { table: "owner_landlords", label: "latest owner" },
  certificate: { table: "certificates", label: "latest certificate" },
};

/** Render a template against a real record (the most recent one of its type). */
export async function previewTemplate(templateId: string): Promise<TemplatePreviewResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const { data: template, error } = await admin
    .from("message_templates")
    .select("*")
    .eq("id", templateId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!template) return { ok: false, error: "Template not found." };

  const tenant = await getTenantMessaging(admin, profile.tenant_id);
  let context = sharedContext(tenant?.name ?? "");
  let entityLabel = "No linked record";

  const entityType = template.entity_type as MessageEntityType | "none";
  if (entityType !== "none") {
    const target = PREVIEW_TABLES[entityType];
    const { data: entity, error: entityErr } = await admin
      .from(target.table)
      .select("id")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (entityErr) return { ok: false, error: entityErr.message };
    if (!entity) {
      return { ok: false, error: `No ${target.label} exists yet to preview against.` };
    }
    const built = await buildMergeContext(admin, {
      tenantId: profile.tenant_id,
      agencyName: tenant?.name ?? "",
      entityType,
      entityId: entity.id as string,
    });
    if (built) {
      context = built.context;
      entityLabel = built.entityLabel;
    }
  }

  // Rule-only fields get an illustrative value in previews.
  context = {
    ...context,
    anchor_date: context.today,
    anchor_date_iso: new Date().toISOString().slice(0, 10),
  };

  const body = renderTemplate(template.body as string, context);
  const subject = template.subject
    ? renderTemplate(template.subject as string, context)
    : null;

  return {
    ok: true,
    subject: subject?.text ?? null,
    body: body.text,
    entityLabel,
    unknownKeys: [...new Set([...body.unknownKeys, ...(subject?.unknownKeys ?? [])])],
  };
}
