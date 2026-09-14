// Per-agency sender identities — the "send from the agency's own address" half
// of the multi-agency layer.
//
// A BRAND changes what a document looks like (logo, colours, display name). A
// SENDER IDENTITY changes who it is actually FROM. The two are independent and
// an agency can have either, both, or neither; `resolveAgencyIdentity` in
// brands.ts combines whatever exists at send time.
//
// The important difference operationally: creating a sender identity makes
// BoldSign EMAIL THE AGENCY a verification link. That is an outward-facing
// action against a third party's mailbox, so nothing here is called
// speculatively — every function in this module is driven by an explicit
// request from the agency, or by a super admin acting with the agency's
// knowledge.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { boldSignErrorMessage, senderIdentitiesApi } from "./client";
import { senderIdentityState, type SenderIdentityState } from "./senderIdentityStatus";

export type SenderIdentityResult =
  | { ok: true; state: SenderIdentityState; email: string }
  | { ok: false; error: string };

type BrandRow = {
  sender_identity_email: string | null;
  sender_identity_id: string | null;
  sender_identity_status: string | null;
  sender_identity_verified_at: string | null;
  brand_id: string | null;
};

async function loadRow(tenantId: string): Promise<BrandRow | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("boldsign_agency_brands")
    .select(
      "sender_identity_email, sender_identity_id, sender_identity_status, sender_identity_verified_at, brand_id"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle<BrandRow>();
  return data ?? null;
}

/**
 * Ask BoldSign to verify an agency mailbox, so documents can be sent from it.
 *
 * BoldSign emails `email` a verification link on success. Nothing is usable
 * until the agency clicks it and `refreshSenderIdentity` sees the approval.
 *
 * The row is written BEFORE the API call for the same reason the document
 * reserve-then-send exists: if the create succeeds and the write fails, we
 * have emailed someone a verification request we have no record of, and the
 * next attempt would email them again. Writing first means the worst case is a
 * row describing a request that didn't happen, which the next refresh clears.
 */
export async function requestSenderIdentity(params: {
  tenantId: string;
  email: string;
  name: string;
}): Promise<SenderIdentityResult> {
  const { tenantId, email, name } = params;
  const admin = createSupabaseAdminClient();

  const existing = await loadRow(tenantId);

  // The table's CHECK requires a brand_id or a sender_identity_email, so a
  // first-time insert must carry the email — which it does.
  const { error: writeError } = await admin.from("boldsign_agency_brands").upsert(
    {
      tenant_id: tenantId,
      sender_identity_email: email,
      sender_identity_status: "Pending",
      sender_identity_requested_at: new Date().toISOString(),
      // Cleared: a new request invalidates any previous verification, and
      // leaving a stale timestamp would let `canSendOnBehalfOf` pass for an
      // address that is no longer approved.
      sender_identity_verified_at: null,
      last_error: null,
    },
    { onConflict: "tenant_id" }
  );

  if (writeError) return { ok: false, error: writeError.message };

  try {
    const api = senderIdentitiesApi();

    // Re-requesting an address BoldSign already knows about is a different
    // call; creating a duplicate returns an error rather than re-sending.
    const isSameAddress =
      existing?.sender_identity_email?.toLowerCase() === email.toLowerCase() &&
      Boolean(existing?.sender_identity_id);

    if (isSameAddress) {
      await api.reRequestSenderIdentities(email);
    } else {
      const created = await api.createSenderIdentities({
        email,
        name,
        // Tie the identity to the agency's brand where one exists, so the
        // verification email itself carries their branding rather than ours.
        brandId: existing?.brand_id ?? undefined,
      });
      if (created.senderIdentityId) {
        await admin
          .from("boldsign_agency_brands")
          .update({ sender_identity_id: created.senderIdentityId })
          .eq("tenant_id", tenantId);
      }
    }
  } catch (err) {
    const message = boldSignErrorMessage(err);
    await admin
      .from("boldsign_agency_brands")
      .update({ last_error: message, sender_identity_status: null })
      .eq("tenant_id", tenantId);
    return { ok: false, error: message };
  }

  return { ok: true, state: "pending", email };
}

/**
 * Re-read the identity's status from BoldSign and persist it.
 *
 * Needed because verification happens entirely outside the app — the agency
 * clicks a link in an email, and no webhook tells us. Called when the settings
 * page loads and when the agency presses refresh.
 */
export async function refreshSenderIdentity(tenantId: string): Promise<SenderIdentityResult> {
  const row = await loadRow(tenantId);
  if (!row?.sender_identity_email) {
    return { ok: false, error: "No sender identity has been requested for this agency." };
  }

  const email = row.sender_identity_email;

  try {
    // listSenderIdentities(page, pageSize, search) — search by the address
    // rather than fetching by id, because the id is absent on rows created
    // before we started storing it.
    const list = await senderIdentitiesApi().listSenderIdentities(1, 10, email);
    const match = (list.result ?? []).find(
      (identity) => identity.email?.toLowerCase() === email.toLowerCase()
    );

    if (!match) {
      // Deleted at the BoldSign end. Clear our side rather than leaving a row
      // that claims an identity exists.
      await createSupabaseAdminClient()
        .from("boldsign_agency_brands")
        .update({
          sender_identity_status: null,
          sender_identity_verified_at: null,
          sender_identity_id: null,
        })
        .eq("tenant_id", tenantId);
      return { ok: true, state: "none", email };
    }

    const state = senderIdentityState(match.status);

    await createSupabaseAdminClient()
      .from("boldsign_agency_brands")
      .update({
        sender_identity_status: match.status ?? null,
        sender_identity_id: match.id ?? row.sender_identity_id,
        // Only an approved identity gets a timestamp, and an identity that
        // stops being approved loses it — otherwise a revoked address would
        // keep passing `canSendOnBehalfOf` forever.
        sender_identity_verified_at:
          state === "verified"
            ? (match.approvedDate ?? new Date().toISOString())
            : null,
        last_error: null,
      })
      .eq("tenant_id", tenantId);

    return { ok: true, state, email };
  } catch (err) {
    return { ok: false, error: boldSignErrorMessage(err) };
  }
}

/** Send the verification email again, for an agency that lost or ignored it. */
export async function resendSenderIdentityInvitation(
  tenantId: string
): Promise<SenderIdentityResult> {
  const row = await loadRow(tenantId);
  if (!row?.sender_identity_email) {
    return { ok: false, error: "No sender identity has been requested for this agency." };
  }

  try {
    await senderIdentitiesApi().resendInvitationSenderIdentities(row.sender_identity_email);
    await createSupabaseAdminClient()
      .from("boldsign_agency_brands")
      .update({ sender_identity_requested_at: new Date().toISOString(), last_error: null })
      .eq("tenant_id", tenantId);
    return { ok: true, state: "pending", email: row.sender_identity_email };
  } catch (err) {
    return { ok: false, error: boldSignErrorMessage(err) };
  }
}

/**
 * Stop sending from the agency's address.
 *
 * Deletes at the BoldSign end as well as ours, because an identity left behind
 * keeps the mailbox on their account and the agency asked for it to stop. A
 * failure there is not fatal — our row is cleared regardless, so sends fall
 * back to the account default immediately, which is the outcome the agency
 * actually asked for.
 */
export async function removeSenderIdentity(
  tenantId: string
): Promise<{ ok: true; warning?: string } | { ok: false; error: string }> {
  const row = await loadRow(tenantId);
  if (!row?.sender_identity_email) return { ok: true };

  let warning: string | undefined;
  try {
    await senderIdentitiesApi().deleteSenderIdentities(row.sender_identity_email);
  } catch (err) {
    warning = `Removed here, but BoldSign reported: ${boldSignErrorMessage(err)}`;
  }

  const admin = createSupabaseAdminClient();

  // The table's CHECK requires brand_id or sender_identity_email. An agency
  // with no brand would violate it if we merely nulled the email, so the row
  // goes entirely — which is also the correct meaning: no identity at all.
  const { error } = row.brand_id
    ? await admin
        .from("boldsign_agency_brands")
        .update({
          sender_identity_email: null,
          sender_identity_id: null,
          sender_identity_status: null,
          sender_identity_verified_at: null,
          sender_identity_requested_at: null,
        })
        .eq("tenant_id", tenantId)
    : await admin.from("boldsign_agency_brands").delete().eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, warning };
}
