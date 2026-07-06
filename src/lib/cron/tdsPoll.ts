// TDS polling job. Extracted from /api/cron/tds-poll so it can be driven by the
// in-process scheduler or an HTTP trigger. Polls every deposit not yet in a
// terminal state, one auth context per tenant.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTdsContext, type TdsContext } from "@/lib/tds/context";
import { pollOneTdsDeposit } from "@/features/tds/lib/pollDeposit";
import type { TdsDeposit } from "@/features/tds/domain/deposit-types";

export type TdsPollSummary = {
  ok: true;
  deposits: number;
  polled: number;
  advanced: number;
  failed: number;
  durationMs: number;
};

const BATCH = 100;
// Poll everything not yet in a terminal state.
const OPEN_STATUSES = ["submitted", "pending"];

export async function runTdsPoll(): Promise<TdsPollSummary> {
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();

  const { data: deposits } = await admin
    .from("tds_deposits")
    .select("*")
    .in("status", OPEN_STATUSES)
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  const rows = (deposits ?? []) as TdsDeposit[];

  // One auth context per tenant.
  const ctxCache = new Map<string, TdsContext | null>();
  async function ctxFor(tenantId: string): Promise<TdsContext | null> {
    if (ctxCache.has(tenantId)) return ctxCache.get(tenantId) ?? null;
    const ctx = await getTdsContext(tenantId).catch(() => null);
    ctxCache.set(tenantId, ctx);
    return ctx;
  }

  let advanced = 0;
  let polled = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const ctx = await ctxFor(row.tenant_id);
      if (!ctx) return "skipped" as const;
      return pollOneTdsDeposit(ctx, row);
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled") {
      polled++;
      if (r.value === "advanced") advanced++;
      if (r.value === "error") failed++;
    } else {
      failed++;
    }
  }

  return {
    ok: true,
    deposits: rows.length,
    polled,
    advanced,
    failed,
    durationMs: Date.now() - startedAt,
  };
}
