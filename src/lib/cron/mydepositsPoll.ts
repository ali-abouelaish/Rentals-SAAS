// mydeposits polling job. Extracted from /api/cron/mydeposits-poll so it can be
// driven by the in-process scheduler or an HTTP trigger. Polls non-terminal
// protections and open release requests, one auth context per tenant.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMdContext, type MdContext } from "@/lib/mydeposits/apiClient";
import { pollOneProtection } from "@/features/mydeposits/lib/pollProtection";
import { pollOneRelease } from "@/features/mydeposits/lib/pollRelease";
import type { MdProtection, MdReleaseRequest } from "@/features/mydeposits/domain/types";

export type MydepositsPollSummary = {
  ok: true;
  protections: number;
  releases: number;
  polled: number;
  advanced: number;
  failed: number;
  durationMs: number;
};

const BATCH = 100;
const TERMINAL = ["protected", "released", "cancelled"];
const OPEN_RELEASE = ["Open", "Negotiation", "Draft", "Resolution"];

export async function runMydepositsPoll(): Promise<MydepositsPollSummary> {
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();

  // Non-terminal protections + open release requests, oldest poll first.
  const [{ data: protections }, { data: releases }] = await Promise.all([
    admin
      .from("mydeposits_protections")
      .select("*")
      .not("status", "in", `(${TERMINAL.join(",")})`)
      .order("last_polled_at", { ascending: true, nullsFirst: true })
      .limit(BATCH),
    admin
      .from("mydeposits_release_requests")
      .select("*")
      .in("status", OPEN_RELEASE)
      .order("last_polled_at", { ascending: true, nullsFirst: true })
      .limit(BATCH),
  ]);

  const protectionRows = (protections ?? []) as MdProtection[];
  const releaseRows = (releases ?? []) as MdReleaseRequest[];

  // One auth context per tenant. Cache the in-flight PROMISE (not the resolved
  // value): the batch starts every row synchronously, so caching only after
  // getMdContext resolves let N rows for one tenant each fire their own token
  // refresh concurrently — and refresh-token rotation makes concurrent reuse
  // invalidate the connection. Sharing the promise collapses them to one call.
  const ctxCache = new Map<string, Promise<MdContext | null>>();
  function ctxFor(tenantId: string): Promise<MdContext | null> {
    let pending = ctxCache.get(tenantId);
    if (!pending) {
      pending = getMdContext(tenantId).catch(() => null);
      ctxCache.set(tenantId, pending);
    }
    return pending;
  }

  let advanced = 0;
  let polled = 0;
  let failed = 0;

  const protectionResults = await Promise.allSettled(
    protectionRows.map(async (row) => {
      const ctx = await ctxFor(row.tenant_id);
      if (!ctx) return "skipped";
      return pollOneProtection(ctx, row);
    })
  );
  for (const r of protectionResults) {
    if (r.status === "fulfilled") {
      polled++;
      if (r.value === "advanced") advanced++;
      if (r.value === "error") failed++;
    } else {
      failed++;
    }
  }

  const releaseResults = await Promise.allSettled(
    releaseRows.map(async (row) => {
      const ctx = await ctxFor(row.tenant_id);
      if (!ctx) return;
      await pollOneRelease(ctx, row);
    })
  );
  for (const r of releaseResults) {
    if (r.status === "fulfilled") polled++;
    else failed++;
  }

  return {
    ok: true,
    protections: protectionRows.length,
    releases: releaseRows.length,
    polled,
    advanced,
    failed,
    durationMs: Date.now() - startedAt,
  };
}
