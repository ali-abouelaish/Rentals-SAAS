"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { presetByKey } from "../domain/presets";
import { ruleInputSchema, type RuleInput, type RuleMode } from "../domain/rules";
import { ensureDefaultTemplates } from "../data/templates";
import { evaluateAutomationRules, type SweepSummary } from "../lib/evaluate";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export async function createRule(input: RuleInput): Promise<CreateResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = ruleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule." };
  }
  const data = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("automation_rules")
    .insert({
      tenant_id: profile.tenant_id,
      name: data.name,
      trigger_type: data.triggerConfig.kind,
      trigger_config: data.triggerConfig,
      conditions: data.conditions,
      repeat_config: data.repeatConfig,
      channel: data.channel,
      template_id: data.templateId,
      recipient_config: data.recipientConfig,
      send_hour: data.sendHour,
      active: false,
      dry_run: false,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/automations");
  return { ok: true, id: row.id as string };
}

/** Create a rule from the preset library — switched off, ready to review. */
export async function createRuleFromPreset(presetKey: string): Promise<CreateResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const preset = presetByKey(presetKey);
  if (!preset) return { ok: false, error: "Unknown preset." };

  await ensureDefaultTemplates(profile.tenant_id);

  const admin = createSupabaseAdminClient();
  const { data: template, error: tplErr } = await admin
    .from("message_templates")
    .select("id")
    .eq("tenant_id", profile.tenant_id)
    .eq("key", preset.templateKey)
    .eq("channel", preset.channel)
    .maybeSingle();
  if (tplErr) return { ok: false, error: tplErr.message };
  if (!template) return { ok: false, error: "Preset template missing." };

  // In-app presets default to the creating user; editable in the builder.
  const recipient =
    preset.recipient ?? ({ kind: "staff", userId: profile.id } as const);

  const { data: row, error } = await admin
    .from("automation_rules")
    .insert({
      tenant_id: profile.tenant_id,
      name: preset.name,
      preset_key: preset.key,
      trigger_type: preset.triggerConfig.kind,
      trigger_config: preset.triggerConfig,
      conditions: preset.conditions,
      repeat_config: preset.repeatConfig,
      channel: preset.channel,
      template_id: template.id,
      recipient_config: recipient,
      send_hour: preset.sendHour,
      active: false,
      dry_run: false,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/automations");
  return { ok: true, id: row.id as string };
}

export async function updateRule(id: string, input: RuleInput): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Invalid rule id." };
  const parsed = ruleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule." };
  }
  const data = parsed.data;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("automation_rules")
    .update({
      name: data.name,
      trigger_type: data.triggerConfig.kind,
      trigger_config: data.triggerConfig,
      conditions: data.conditions,
      repeat_config: data.repeatConfig,
      channel: data.channel,
      template_id: data.templateId,
      recipient_config: data.recipientConfig,
      send_hour: data.sendHour,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/automations");
  revalidatePath(`/automations/rules/${id}`);
  return { ok: true };
}

export async function deleteRule(id: string): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("automation_rules")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/automations");
  return { ok: true };
}

export async function setRuleMode(id: string, mode: RuleMode): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const patch =
    mode === "live"
      ? { active: true, dry_run: false }
      : mode === "dry_run"
        ? { active: false, dry_run: true }
        : { active: false, dry_run: false };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("automation_rules")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/automations");
  revalidatePath(`/automations/rules/${id}`);
  return { ok: true };
}

export type RunNowResult =
  | ({ ok: true } & Omit<SweepSummary, "ok">)
  | { ok: false; error: string };

/**
 * Evaluate one rule immediately (dry-run rules log would-sends; live rules
 * enqueue for their send hour). The runs table dedupes against the daily
 * sweep, so this is always safe.
 */
export async function runRuleNow(id: string): Promise<RunNowResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { data: rule, error } = await admin
    .from("automation_rules")
    .select("id, tenant_id, active, dry_run")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!rule) return { ok: false, error: "Rule not found." };
  if (!rule.active && !rule.dry_run) {
    return { ok: false, error: "Switch the rule to dry run or live first." };
  }

  const summary = await evaluateAutomationRules(new Date(), { ruleId: id });
  revalidatePath(`/automations/rules/${id}`);
  return summary;
}
