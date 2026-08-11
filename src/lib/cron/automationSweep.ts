// Daily automation-rule sweep. Scheduled 08:30 London — after the 08:00
// email-provider health check and before the default 09:00 send hour, so
// same-day sends are queued in time and a dead mailbox has already been
// flagged. Safe to re-invoke (HTTP backup trigger, restarts): the
// automation_runs unique index dedupes every (rule, entity, occasion).

import {
  evaluateAutomationRules,
  type SweepSummary,
} from "@/features/automations/lib/evaluate";
import { londonHour } from "@/features/automations/lib/london";

export type AutomationSweepSummary =
  | SweepSummary
  | { ok: true; skipped: true; reason: string; durationMs: number };

/** Only proceeds 07:00–09:59 London (same self-guard pattern as rentReminders). */
export async function runAutomationSweep(now: Date = new Date()): Promise<AutomationSweepSummary> {
  const startedAt = Date.now();
  const hour = londonHour(now);
  if (hour < 7 || hour > 9) {
    return {
      ok: true,
      skipped: true,
      reason: "Outside Europe/London 07:00-09:59 sweep window",
      durationMs: Date.now() - startedAt,
    };
  }
  return evaluateAutomationRules(now);
}
