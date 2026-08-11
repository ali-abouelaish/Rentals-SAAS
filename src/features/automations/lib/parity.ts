// Rent-reminder migration helpers: the dry-run parity diff (compare what the
// new rent rules WOULD send against what the legacy cron DID send) and the
// cutover shim (claim the legacy rent_reminder_log slot before sending, so
// during the transition it is physically impossible for both systems to email
// the same contract for the same period — the same unique constraint the
// legacy cron itself claims through).

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AutomationRuleRow } from "../domain/rules";
import type { ScheduledMessageRow } from "../domain/types";
import { addDaysISO } from "./london";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** preset key → legacy rent_reminder_log.reminder_type */
export const RENT_PRESET_TO_REMINDER_TYPE: Record<string, string> = {
  rent_due_3d: "upcoming_3d",
  rent_due_today: "due_today",
};

function shimMarker(messageId: string): string {
  return `automation:${messageId}`;
}

/**
 * Claim the (contract, period, type) slot in rent_reminder_log before a
 * rent-preset message sends. Returns proceed:false when the legacy cron (or a
 * manual send) already owns the slot. Our own claim from an earlier failed
 * attempt is recognised by its marker and lets the retry through.
 */
export async function claimLegacyRentSlot(
  admin: Admin,
  row: ScheduledMessageRow,
  rule: AutomationRuleRow
): Promise<{ proceed: boolean; reason?: string }> {
  const reminderType = RENT_PRESET_TO_REMINDER_TYPE[rule.preset_key ?? ""];
  if (!reminderType) return { proceed: true };

  const anchorISO = row.merge_context?.anchor_date_iso;
  if (!anchorISO || row.related_entity_type !== "tenancy" || !row.related_entity_id) {
    return { proceed: true };
  }

  const { data: contract, error: contractErr } = await admin
    .from("property_contracts")
    .select("pm_tenant_id")
    .eq("id", row.related_entity_id)
    .maybeSingle();
  if (contractErr) throw new Error(contractErr.message);
  if (!contract?.pm_tenant_id) {
    return { proceed: false, reason: "Tenancy has no renter attached" };
  }

  const marker = shimMarker(row.id);
  const { error } = await admin.from("rent_reminder_log").insert({
    tenant_id: row.tenant_id,
    contract_id: row.related_entity_id,
    pm_tenant_id: contract.pm_tenant_id,
    reminder_type: reminderType,
    period_start: anchorISO,
    status: "sent",
    email_provider_id: marker,
  });

  if (!error) return { proceed: true };
  if ((error as { code?: string }).code === "23505") {
    const { data: existing } = await admin
      .from("rent_reminder_log")
      .select("email_provider_id")
      .eq("contract_id", row.related_entity_id)
      .eq("period_start", anchorISO)
      .eq("reminder_type", reminderType)
      .maybeSingle();
    if (existing?.email_provider_id === marker) {
      // Our own claim from a previous (failed) attempt — retry may proceed.
      return { proceed: true };
    }
    return { proceed: false, reason: "Legacy rent reminder already sent for this period" };
  }
  // Unexpected claim failure: do NOT send (a duplicate is worse than a retry).
  throw new Error(`rent_reminder_log claim failed: ${error.message}`);
}

/** After a successful send, replace the shim marker with the real provider id
 *  so the Resend bounce webhook can still correlate the log row. */
export async function recordLegacyClaimProviderId(
  admin: Admin,
  row: ScheduledMessageRow,
  providerId: string | null
): Promise<void> {
  if (!providerId) return;
  const { error } = await admin
    .from("rent_reminder_log")
    .update({ email_provider_id: providerId })
    .eq("email_provider_id", shimMarker(row.id));
  if (error) {
    console.error("[automations] failed to record provider id on legacy claim", error.message);
  }
}

/** After a failed send, downgrade our optimistic claim (mirrors the legacy
 *  cron's own downgrade-on-failure behaviour). */
export async function downgradeLegacyClaimOnFailure(
  admin: Admin,
  row: Pick<ScheduledMessageRow, "id" | "rule_id">,
  errorMessage: string
): Promise<void> {
  if (!row.rule_id) return;
  const { error } = await admin
    .from("rent_reminder_log")
    .update({ status: "failed", error_message: errorMessage.slice(0, 500) })
    .eq("email_provider_id", shimMarker(row.id));
  if (error) {
    console.error("[automations] failed to downgrade legacy claim", error.message);
  }
}

export type RentParityDiff = {
  date: string;
  /** Sent by the legacy cron but NOT matched by the new rules. */
  onlyLegacy: string[];
  /** Matched by the new rules but NOT sent by the legacy cron. */
  onlyNew: string[];
  both: number;
};

/**
 * Set-compare one day's rent-rule evaluation (dry-run or live automation_runs)
 * against the legacy rent_reminder_log for the same targets. Empty diffs in
 * both directions across a full cycle = safe to cut the tenant over.
 */
export async function diffRentReminderParity(
  admin: Admin,
  tenantId: string,
  runDateISO: string
): Promise<RentParityDiff> {
  const { data: rules, error: rulesErr } = await admin
    .from("automation_rules")
    .select("id, preset_key")
    .eq("tenant_id", tenantId)
    .in("preset_key", Object.keys(RENT_PRESET_TO_REMINDER_TYPE));
  if (rulesErr) throw new Error(rulesErr.message);
  const typeByRule = new Map<string, string>();
  for (const r of rules ?? []) {
    typeByRule.set(r.id as string, RENT_PRESET_TO_REMINDER_TYPE[r.preset_key as string]);
  }

  const newSide = new Set<string>();
  if (typeByRule.size > 0) {
    const { data: runs, error: runsErr } = await admin
      .from("automation_runs")
      .select("rule_id, entity_id, anchor_date")
      .in("rule_id", [...typeByRule.keys()])
      .eq("run_date", runDateISO);
    if (runsErr) throw new Error(runsErr.message);
    for (const run of runs ?? []) {
      const type = typeByRule.get(run.rule_id as string);
      if (type && run.anchor_date) {
        newSide.add(`${run.entity_id}|${type}|${run.anchor_date}`);
      }
    }
  }

  // Legacy targets for the same run day: due_today → period_start = day,
  // upcoming_3d → period_start = day + 3. Exclude rows our own shim wrote.
  const legacySide = new Set<string>();
  const targets: { type: string; period: string }[] = [
    { type: "due_today", period: runDateISO },
    { type: "upcoming_3d", period: addDaysISO(runDateISO, 3) },
  ];
  for (const target of targets) {
    const { data: logs, error: logsErr } = await admin
      .from("rent_reminder_log")
      .select("contract_id, reminder_type, period_start, email_provider_id")
      .eq("tenant_id", tenantId)
      .eq("reminder_type", target.type)
      .eq("period_start", target.period);
    if (logsErr) throw new Error(logsErr.message);
    for (const log of logs ?? []) {
      if (String(log.email_provider_id ?? "").startsWith("automation:")) continue;
      legacySide.add(`${log.contract_id}|${log.reminder_type}|${log.period_start}`);
    }
  }

  const onlyLegacy = [...legacySide].filter((k) => !newSide.has(k));
  const onlyNew = [...newSide].filter((k) => !legacySide.has(k));
  const both = [...newSide].filter((k) => legacySide.has(k)).length;

  return { date: runDateISO, onlyLegacy, onlyNew, both };
}
