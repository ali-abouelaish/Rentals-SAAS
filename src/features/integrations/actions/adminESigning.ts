"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { isBoldSignConfigured } from "@/lib/boldsign/config";
import { syncAgencyBrand } from "@/lib/boldsign/brands";
import { refreshSenderIdentity } from "@/lib/boldsign/senderIdentity";

const ADMIN_PATH = "/admin/e-signing";

type Result = { error: string } | { success: true; message: string };

/**
 * Push an agency's branding to BoldSign on their behalf.
 *
 * Deliberately does NOT record consent. The consent columns exist to evidence
 * that the *agency* agreed to documents going out under its name, and a super
 * admin cannot give that on their behalf — recording it here would turn the
 * evidence into a rubber stamp. The agency's own button on
 * /settings/e-signing is what records it.
 *
 * This exists for onboarding and for fixing a failed sync, both of which are
 * safe: a brand changes what a document looks like, it does not change who it
 * is from and it emails nobody.
 */
export async function adminSyncAgencyBrandAction(input: {
  tenantId: string;
  force?: boolean;
}): Promise<Result> {
  await requireSuperAdmin();

  if (!input.tenantId) return { error: "No agency selected." };
  if (!isBoldSignConfigured()) {
    return { error: "BOLDSIGN_API_KEY is not set on this environment." };
  }

  const result = await syncAgencyBrand(input.tenantId, { force: input.force ?? false });
  revalidatePath(ADMIN_PATH);

  if (!result.ok) return { error: result.error };

  if (result.skipped === "unchanged") {
    return { success: true, message: "Already up to date — nothing to push." };
  }

  return {
    success: true,
    message: result.created ? "Brand created." : "Brand updated.",
  };
}

/**
 * Re-read an agency's sender identity status from BoldSign.
 *
 * Safe for a super admin to trigger: it only reads. Provisioning a NEW identity
 * is not exposed here, because that emails the agency's mailbox a verification
 * link — an outward-facing action that should come from the agency pressing
 * the button themselves.
 */
export async function adminRefreshSenderIdentityAction(input: {
  tenantId: string;
}): Promise<Result> {
  await requireSuperAdmin();

  if (!input.tenantId) return { error: "No agency selected." };

  const result = await refreshSenderIdentity(input.tenantId);
  revalidatePath(ADMIN_PATH);

  return result.ok
    ? { success: true, message: `Status refreshed: ${result.state}.` }
    : { error: result.error };
}
