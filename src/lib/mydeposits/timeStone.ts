// TimeStone service: release requests + settlements (negotiate / accept).
// Endpoint paths are best-effort (see config.ts MD_SERVICE / MD_API_VERSION).

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
    `${TS}/release-requests/${encodeURIComponent(releaseRequestId)}/settlements/${encodeURIComponent(settlementId)}/amend`,
    { method: "POST", body: JSON.stringify(body), protectionId }
  );
  return zSettlement.parse(raw);
}

export async function cancelReleaseRequest(
  ctx: MdContext,
  releaseRequestId: string,
  protectionId?: string
): Promise<void> {
  await mdFetch<unknown>(
    ctx,
    `${TS}/release-requests/${encodeURIComponent(releaseRequestId)}/cancel`,
    { method: "POST", protectionId }
  );
}
