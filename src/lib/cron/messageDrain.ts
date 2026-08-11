// Scheduled-messages drain job. Runs every 5 minutes via the in-process
// scheduler (src/lib/cron/scheduler.ts) so ad-hoc reminders aren't stuck
// waiting for a daily sweep. Safe to invoke concurrently — the claim RPC uses
// FOR UPDATE SKIP LOCKED.

import {
  drainScheduledMessages,
  type MessageDrainResult,
} from "@/features/automations/lib/dispatch";

export type MessageDrainSummary = MessageDrainResult & {
  ok: true;
  durationMs: number;
};

export async function runMessageDrain(): Promise<MessageDrainSummary> {
  const startedAt = Date.now();
  const result = await drainScheduledMessages(20);
  return { ok: true, ...result, durationMs: Date.now() - startedAt };
}
