// Shared release-request polling, used by the manual refresh action and the cron.

import type { MdContext } from "@/lib/mydeposits/apiClient";
import {
  getReleaseRequest,
  getReleaseAvailableActions,
  getSettlements,
} from "@/lib/mydeposits/timeStone";
import type { MdReleaseRequest } from "../domain/types";

/** Pull the latest remote state for a release request and persist it. */
export async function pollOneRelease(ctx: MdContext, releaseRow: MdReleaseRequest): Promise<void> {
  if (!releaseRow.remote_release_id) return;
  const remoteId = releaseRow.remote_release_id;

  const [request, actions, settlements] = await Promise.all([
    getReleaseRequest(ctx, remoteId, releaseRow.protection_id).catch(() => null),
    getReleaseAvailableActions(ctx, remoteId, releaseRow.protection_id).catch(() => []),
    getSettlements(ctx, remoteId, releaseRow.protection_id).catch(() => []),
  ]);

  await ctx.admin
    .from("mydeposits_release_requests")
    .update({
      status: (request?.status as string | undefined) ?? releaseRow.status,
      available_actions: actions,
      settlements,
      last_polled_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", releaseRow.id);
}
