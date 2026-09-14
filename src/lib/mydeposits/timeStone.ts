// TimeStone service: release requests + settlements (negotiate / accept).
// Paths verified live against sandbox 2026-08-21 (route existence confirmed by
// an empty 404 body vs the gateway's "Resource not found" envelope).

import { mdFetch, type MdContext } from "./apiClient";
import { MD_API_VERSION, MD_SERVICE } from "./config";
import {
  zReleaseRequest,
  zSettlement,
  zSettlementList,
  pickId,
  type MdReleaseRequest,
  type MdSettlement,
} from "./schemas";

const TS = `${MD_SERVICE.timeStone}/${MD_API_VERSION}`;

/**
 * Release-request status ids from `/ts/api/v1/lookups/release-request-statuses`
 * (verified 2026-08-21). Note the scheme spells it "canceled".
 */
export const MD_RELEASE_STATUS = {
  draft: 1,
  open: 11,
  negotiation: 21,
  unclaimed: 26,
  accepted: 31,
  court: 41,
  evidenceReview: 46,
  resolution: 51,
  resolved: 55,
  canceled: 61,
  singleRelease: 71,
  closed: 81,
} as const;

export async function createReleaseRequest(
  ctx: MdContext,
  body: { depositId: string },
  protectionId?: string
): Promise<{ releaseRequestId: string | null; raw: MdReleaseRequest }> {
  const raw = await mdFetch<Record<string, unknown>>(ctx, `${TS}/release-requests`, {
    method: "POST",
    body: JSON.stringify(body),
    protectionId,
  });
  const parsed = zReleaseRequest.parse(raw);
  return { releaseRequestId: pickId(raw, "releaseRequestId", "id"), raw: parsed };
}

export async function getReleaseRequest(
  ctx: MdContext,
  releaseRequestId: string,
  protectionId?: string
): Promise<MdReleaseRequest> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${TS}/release-requests/${encodeURIComponent(releaseRequestId)}`,
    { protectionId }
  );
  return zReleaseRequest.parse(raw);
}

export async function getReleaseAvailableActions(
  ctx: MdContext,
  releaseRequestId: string,
  protectionId?: string
): Promise<unknown[]> {
  const raw = await mdFetch<unknown>(
    ctx,
    `${TS}/release-requests/${encodeURIComponent(releaseRequestId)}/available-actions`,
    { protectionId }
  );
  return Array.isArray(raw) ? raw : [];
}

export async function getSettlements(
  ctx: MdContext,
  releaseRequestId: string,
  protectionId?: string
): Promise<MdSettlement[]> {
  const raw = await mdFetch<unknown>(
    ctx,
    `${TS}/release-requests/${encodeURIComponent(releaseRequestId)}/settlements`,
    { protectionId }
  );
  return zSettlementList.parse(Array.isArray(raw) ? raw : []);
}

export async function createSettlement(
  ctx: MdContext,
  releaseRequestId: string,
  body: Record<string, unknown>,
  protectionId?: string
): Promise<MdSettlement> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${TS}/release-requests/${encodeURIComponent(releaseRequestId)}/settlements`,
    { method: "POST", body: JSON.stringify(body), protectionId }
  );
  return zSettlement.parse(raw);
}

export async function updateSettlement(
  ctx: MdContext,
  releaseRequestId: string,
  settlementId: string,
  body: Record<string, unknown>,
  protectionId?: string
): Promise<MdSettlement> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    `${TS}/release-requests/${encodeURIComponent(releaseRequestId)}/settlements/${encodeURIComponent(settlementId)}`,
    { method: "PUT", body: JSON.stringify(body), protectionId }
  );
  return zSettlement.parse(raw);
}

/** Counter-offer / negotiate an existing settlement. */
export async function amendSettlement(
  ctx: MdContext,
  releaseRequestId: string,
  settlementId: string,
  body: Record<string, unknown>,
  protectionId?: string
): Promise<MdSettlement> {
  const raw = await mdFetch<Record<string, unknown>>(
    ctx,
    // Amendment is request-scoped, not settlement-scoped; the settlement id
    // goes in the body. `/settlements/{id}/amend` does not exist.
    `${TS}/release-requests/${encodeURIComponent(releaseRequestId)}/settlements/amendment`,
    { method: "POST", body: JSON.stringify({ settlementId, ...body }), protectionId }
  );
  return zSettlement.parse(raw);
}

/**
 * Cancel via the status endpoint — `POST /release-requests/{id}/cancel` does
 * not exist. `statusId` comes from `look-up` set
 * `/ts/api/v1/lookups/release-request-statuses`.
 */
export async function cancelReleaseRequest(
  ctx: MdContext,
  releaseRequestId: string,
  protectionId?: string,
  statusId: number = MD_RELEASE_STATUS.canceled
): Promise<void> {
  await mdFetch<unknown>(
    ctx,
    `${TS}/release-requests/${encodeURIComponent(releaseRequestId)}/status`,
    { method: "PUT", body: JSON.stringify({ statusId }), protectionId }
  );
}
