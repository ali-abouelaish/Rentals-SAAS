"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { isBoldSignConfigured } from "@/lib/boldsign/config";
import { recordBrandConsent, syncAgencyBrand } from "@/lib/boldsign/brands";
import {
  refreshSenderIdentity,
  removeSenderIdentity,
  requestSenderIdentity,
  resendSenderIdentityInvitation,
} from "@/lib/boldsign/senderIdentity";
import { requestSenderIdentitySchema } from "../domain/esigningSchemas";

const PAGE = "/settings/e-signing";

type Result = { error: string } | { success: true; message: string };

/**
 * Every action here is gated the same way, and getting it wrong in one place
 * is the whole risk — a server action is a public endpoint regardless of what
 * the UI renders.
 */
type Gate =
  | { ok: true; tenantId: string; userId: string }
  | { ok: false; error: string };

async function requireESigningAdmin(): Promise<Gate> {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!(await hasFeature("e_signing"))) {
    return {
      ok: false,
      error:
        "E-signing isn't active on your account. Activate it under Settings → Integrations.",
    };
  }
  if (!isBoldSignConfigured()) {
    return {
      ok: false,
      error: "E-signing isn't connected yet. Contact us and we'll finish setting it up.",
    };
  }
  return { ok: true, tenantId: profile.tenant_id, userId: profile.id };
}

/**
 * Push the agency's Harbor Ops branding to BoldSign, and record that they
 * asked for it.
 *
 * The click IS the consent — an agency admin pressing "Apply my branding" is
 * exactly the permission the consent columns exist to evidence, so there is no
 * separate tickbox. A super admin doing the same thing from the admin screen
 * does NOT record consent, because it isn't theirs to give.
 */
export async function applyAgencyBrandingAction(): Promise<Result> {
  const gate = await requireESigningAdmin();
  if (!gate.ok) return { error: gate.error };

  const result = await syncAgencyBrand(gate.tenantId, { force: false });

  if (!result.ok) {
    return { error: result.error };
  }

  // Consent is recorded after the sync, because the row the consent columns
  // live on is created by the sync. A failure here is worth surfacing rather
  // than swallowing: the branding is live but we hold no record of permission.
  const consent = await recordBrandConsent({
    tenantId: gate.tenantId,
    userId: gate.userId,
    note: "Applied from the agency's own e-signing settings.",
  });

  revalidatePath(PAGE);

  if (!consent.ok) {
    return {
      success: true,
      message: "Branding applied, but we couldn't record your confirmation. Please tell us.",
    };
  }

  if (result.skipped === "unchanged") {
    return { success: true, message: "Your branding is already up to date." };
  }

  return {
    success: true,
    message: result.created
      ? "Your branding is now applied to documents you send."
      : "Your branding has been updated.",
  };
}

/** Re-push branding that has drifted from what BoldSign holds. */
export async function resyncAgencyBrandingAction(): Promise<Result> {
  const gate = await requireESigningAdmin();
  if (!gate.ok) return { error: gate.error };

  const result = await syncAgencyBrand(gate.tenantId, { force: true });
  revalidatePath(PAGE);

  return result.ok
    ? { success: true, message: "Your branding has been updated." }
    : { error: result.error };
}

export async function requestSenderIdentityAction(input: {
  email: string;
  displayName: string;
  acknowledgeVerification: boolean;
}): Promise<Result> {
  const gate = await requireESigningAdmin();
  if (!gate.ok) return { error: gate.error };

  const parsed = requestSenderIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const result = await requestSenderIdentity({
    tenantId: gate.tenantId,
    email: parsed.data.email,
    name: parsed.data.displayName,
  });

  revalidatePath(PAGE);

  return result.ok
    ? {
        success: true,
        message: `Verification email sent to ${parsed.data.email}. Documents keep sending as they do now until it's confirmed.`,
      }
    : { error: result.error };
}

/**
 * Verification happens in an email, outside the app, with no webhook to tell
 * us — so the only way to learn it happened is to ask.
 */
export async function refreshSenderIdentityAction(): Promise<Result> {
  const gate = await requireESigningAdmin();
  if (!gate.ok) return { error: gate.error };

  const result = await refreshSenderIdentity(gate.tenantId);
  revalidatePath(PAGE);

  if (!result.ok) return { error: result.error };

  const message = {
    verified: "Verified. Documents now send from your own address.",
    pending: "Still waiting on verification — check the inbox for that address.",
    declined: "That address was declined. Request it again, or use a different one.",
    none: "That address is no longer set up with the signing provider.",
    unknown: "The signing provider returned a status we don't recognise. Please tell us.",
  }[result.state];

  return { success: true, message };
}

export async function resendSenderIdentityAction(): Promise<Result> {
  const gate = await requireESigningAdmin();
  if (!gate.ok) return { error: gate.error };

  const result = await resendSenderIdentityInvitation(gate.tenantId);
  revalidatePath(PAGE);

  return result.ok
    ? { success: true, message: `Verification email sent again to ${result.email}.` }
    : { error: result.error };
}

export async function removeSenderIdentityAction(): Promise<Result> {
  const gate = await requireESigningAdmin();
  if (!gate.ok) return { error: gate.error };

  const result = await removeSenderIdentity(gate.tenantId);
  revalidatePath(PAGE);

  if (!result.ok) return { error: result.error };

  return {
    success: true,
    message:
      result.warning ??
      "Documents will now send from the default address instead of yours.",
  };
}
