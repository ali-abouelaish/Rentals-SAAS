"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getMdContext, type MdContext } from "@/lib/mydeposits/apiClient";
import {
  createReleaseRequest,
  createSettlement,
  amendSettlement,
  cancelReleaseRequest,
} from "@/lib/mydeposits/timeStone";
import { pollOneRelease } from "../lib/pollRelease";
import type { MdProtection, MdReleaseRequest } from "../domain/types";

type AdminClient = MdContext["admin"];

async function loadProtection(admin: AdminClient, tenantId: string, protectionId: string): Promise<MdProtection> {
  const { data, error } = await admin
    .from("mydeposits_protections")
    .select("*")
    .eq("id", protectionId)
    .eq("tenant_id", tenantId)
    .single();
  if (error || !data) throw new Error("Protection not found.");
  return data as MdProtection;
}

async function loadReleaseRow(
  admin: AdminClient,
  tenantId: string,
  releaseRequestId: string
): Promise<MdReleaseRequest> {
  const { data, error } = await admin
    .from("mydeposits_release_requests")
    .select("*")
    .eq("remote_release_id", releaseRequestId)
    .eq("tenant_id", tenantId)
    .single();
  if (error || !data) throw new Error("Release request not found.");
  return data as MdReleaseRequest;
}

export async function initiateReleaseRequest(protectionId: string): Promise<{ ok: boolean }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const ctx = await getMdContext(profile.tenant_id);
  const protection = await loadProtection(ctx.admin, profile.tenant_id, protectionId);

  if (protection.status !== "protected") {
    throw new Error("Deposit must be protected before a release can be requested.");
  }
  if (!protection.remote_deposit_id) throw new Error("Protection has no remote deposit id.");

  const { releaseRequestId, raw } = await createReleaseRequest(
    ctx,
    { depositId: protection.remote_deposit_id },
    protectionId
  );

  await ctx.admin.from("mydeposits_release_requests").insert({
    tenant_id: profile.tenant_id,
    protection_id: protectionId,
    remote_release_id: releaseRequestId,
    status: (raw.status as string | undefined) ?? "Open",
    created_by: profile.id,
  });

  await ctx.admin
    .from("mydeposits_protections")
    .update({ status: "release_requested" })
    .eq("id", protectionId);

  revalidatePath("/deposits");
  return { ok: true };
}

export async function refreshReleaseRequest(releaseRequestId: string): Promise<{ ok: boolean }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const ctx = await getMdContext(profile.tenant_id);
  const releaseRow = await loadReleaseRow(ctx.admin, profile.tenant_id, releaseRequestId);
  await pollOneRelease(ctx, releaseRow);
  revalidatePath("/deposits");
  return { ok: true };
}

export async function respondToSettlement(args: {
  releaseRequestId: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const ctx = await getMdContext(profile.tenant_id);
  const releaseRow = await loadReleaseRow(ctx.admin, profile.tenant_id, args.releaseRequestId);

  await createSettlement(ctx, args.releaseRequestId, args.payload, releaseRow.protection_id);
  await pollOneRelease(ctx, releaseRow);
  revalidatePath("/deposits");
  return { ok: true };
}

export async function amendSettlementAction(args: {
  releaseRequestId: string;
  settlementId: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const ctx = await getMdContext(profile.tenant_id);
  const releaseRow = await loadReleaseRow(ctx.admin, profile.tenant_id, args.releaseRequestId);

  await amendSettlement(
    ctx,
    args.releaseRequestId,
    args.settlementId,
    args.payload,
    releaseRow.protection_id
  );
  await pollOneRelease(ctx, releaseRow);
  revalidatePath("/deposits");
  return { ok: true };
}

export async function cancelReleaseRequestAction(releaseRequestId: string): Promise<{ ok: boolean }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const ctx = await getMdContext(profile.tenant_id);
  const releaseRow = await loadReleaseRow(ctx.admin, profile.tenant_id, releaseRequestId);

  await cancelReleaseRequest(ctx, releaseRequestId, releaseRow.protection_id);
  await ctx.admin
    .from("mydeposits_release_requests")
    .update({ status: "Cancelled", last_polled_at: new Date().toISOString() })
    .eq("id", releaseRow.id);
  await ctx.admin
    .from("mydeposits_protections")
    .update({ status: "protected" })
    .eq("id", releaseRow.protection_id);

  revalidatePath("/deposits");
  return { ok: true };
}
