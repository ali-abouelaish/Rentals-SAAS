"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { notifyMarketingClaim } from "@/lib/email/notify-marketing-claim";
import {
  finalizeMarketingClaimSchema,
  marketingClaimProofPrefix,
  startMarketingClaimSchema,
  type FinalizeMarketingClaimInput,
  type StartMarketingClaimInput,
} from "@/features/rentals/domain/marketing-claims";

export type StartClaimResult = {
  ok: boolean;
  claimId?: string;
  /** Storage prefix the browser must upload every proof file under. */
  uploadPrefix?: string;
  error?: string;
};

export type ClaimResult = {
  ok: boolean;
  claimId?: string;
  error?: string;
};

/**
 * `redirect()` and `notFound()` signal control flow by throwing. A blanket
 * catch would swallow them and turn a "your session expired" redirect into a
 * meaningless error string, so they have to be re-thrown.
 */
function isNextControlFlowError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest === "NEXT_NOT_FOUND" || digest.startsWith("NEXT_REDIRECT"))
  );
}

/**
 * Step 1 of a marketing claim — an agent (typically a marketing-only agent)
 * asserts they did the marketing on this rental. Runs every eligibility check
 * and creates the pending claim, then hands back the storage prefix the
 * browser uploads its proof screenshots to.
 *
 * The claim only becomes visible work once `finalizeMarketingClaim` registers
 * at least one proof; if the uploads fail outright the client calls
 * `discardMarketingClaim` so the agent can retry instead of being blocked by
 * their own empty claim.
 */
export async function startMarketingClaim(
  input: StartMarketingClaimInput
): Promise<StartClaimResult> {
  try {
    const parsed = startMarketingClaimSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid claim." };
    }
    const { rentalId, note } = parsed.data;

    const supabase = createSupabaseServerClient();
    const profile = await requireUserProfile();

    const role = (profile.role ?? "").toLowerCase();
    const isMarketingCapableRole =
      role === "agent" || role === "marketing_only" || isAdminRole(role);
    if (!isMarketingCapableRole) {
      return { ok: false, error: "You do not have permission to claim marketing on rentals." };
    }

    const { data: rental, error: rentalError } = await supabase
      .from("rental_codes")
      .select("id, tenant_id, code, assisted_by_agent_id")
      .eq("id", rentalId)
      .maybeSingle();
    if (rentalError) return { ok: false, error: rentalError.message };
    if (!rental) return { ok: false, error: "Rental not found." };

    if (rental.assisted_by_agent_id === profile.id) {
      return { ok: false, error: "You assisted this rental — you cannot also claim marketing on it." };
    }

    const { data: existing } = await supabase
      .from("rental_marketing_claims")
      .select("id, status")
      .eq("rental_id", rentalId)
      .eq("agent_id", profile.id)
      .maybeSingle();
    if (existing) {
      return {
        ok: false,
        error:
          existing.status === "rejected"
            ? "Your previous claim was rejected. Ask an admin to reopen it."
            : "You have already claimed marketing on this rental.",
      };
    }

    const { data: claim, error: claimError } = await supabase
      .from("rental_marketing_claims")
      .insert({
        tenant_id: profile.tenant_id,
        rental_id: rentalId,
        agent_id: profile.id,
        note: note || null,
        status: "pending",
      })
      .select("id")
      .single();
    if (claimError) return { ok: false, error: claimError.message };

    return {
      ok: true,
      claimId: claim.id,
      uploadPrefix: marketingClaimProofPrefix(profile.tenant_id, rental.id, claim.id),
    };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    console.error("[startMarketingClaim] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
  }
}

/**
 * Step 2 — register the proof files the browser has already uploaded, then
 * log and notify. Paths are checked against the claim's own storage prefix so
 * a caller can't attach objects belonging to another claim or tenant.
 */
export async function finalizeMarketingClaim(
  input: FinalizeMarketingClaimInput
): Promise<ClaimResult> {
  try {
    const parsed = finalizeMarketingClaimSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid proof list." };
    }
    const { claimId, files } = parsed.data;

    const supabase = createSupabaseServerClient();
    const profile = await requireUserProfile();

    const { data: claim, error: claimError } = await supabase
      .from("rental_marketing_claims")
      .select("id, tenant_id, rental_id, agent_id, status")
      .eq("id", claimId)
      .maybeSingle();
    if (claimError) return { ok: false, error: claimError.message };
    if (!claim) return { ok: false, error: "Claim not found." };
    if (claim.agent_id !== profile.id) {
      return { ok: false, error: "You can only attach proof to your own claim." };
    }
    if (claim.status !== "pending") {
      return { ok: false, error: "Claim has already been reviewed." };
    }

    const prefix = `${marketingClaimProofPrefix(claim.tenant_id, claim.rental_id, claim.id)}/`;
    if (files.some((file) => !file.path.startsWith(prefix))) {
      return { ok: false, error: "Proof was uploaded to an unexpected location." };
    }

    const { error: proofInsertError } = await supabase
      .from("rental_marketing_claim_proofs")
      .insert(
        files.map((file) => ({
          tenant_id: claim.tenant_id,
          claim_id: claim.id,
          file_path: file.path,
          file_name: file.name,
        }))
      );
    if (proofInsertError) return { ok: false, error: proofInsertError.message };

    const { data: rental } = await supabase
      .from("rental_codes")
      .select("code")
      .eq("id", claim.rental_id)
      .maybeSingle();

    await supabase.from("activity_log").insert({
      tenant_id: claim.tenant_id,
      actor_user_id: profile.id,
      action: "marketing_claim_created",
      entity_type: "rental",
      entity_id: claim.rental_id,
      metadata: { claim_id: claim.id, rental_code: rental?.code ?? null },
    });

    await notifyMarketingClaim(claim.id);

    revalidatePath(`/rentals/${claim.rental_id}`);
    revalidatePath("/rentals");
    return { ok: true, claimId: claim.id };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    console.error("[finalizeMarketingClaim] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
  }
}

/**
 * Roll back a claim whose proof uploads all failed. Without this the agent is
 * locked out by the (rental_id, agent_id) unique constraint on their own empty
 * claim and can never retry.
 */
export async function discardMarketingClaim(claimId: string): Promise<ClaimResult> {
  try {
    if (!claimId) return { ok: false, error: "Missing claim id." };
    const supabase = createSupabaseServerClient();
    const profile = await requireUserProfile();

    const { data: claim } = await supabase
      .from("rental_marketing_claims")
      .select("id, agent_id, status, rental_marketing_claim_proofs(id)")
      .eq("id", claimId)
      .maybeSingle();
    if (!claim) return { ok: true };
    if (claim.agent_id !== profile.id || claim.status !== "pending") {
      return { ok: false, error: "This claim can no longer be withdrawn." };
    }
    if ((claim.rental_marketing_claim_proofs ?? []).length > 0) {
      return { ok: false, error: "This claim already has proof attached." };
    }

    const { error } = await supabase
      .from("rental_marketing_claims")
      .delete()
      .eq("id", claimId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    console.error("[discardMarketingClaim] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function reviewMarketingClaim(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createSupabaseServerClient();
    const profile = await requireUserProfile();
    const claimId = String(formData.get("claim_id") ?? "");
    const decision = String(formData.get("decision") ?? "");
    const rejectReason = String(formData.get("reject_reason") ?? "").trim();

    if (!claimId) return { ok: false, error: "Missing claim id." };
    if (decision !== "approved" && decision !== "rejected") {
      return { ok: false, error: "Invalid decision." };
    }

    const { data: claim, error: claimError } = await supabase
      .from("rental_marketing_claims")
      .select("id, rental_id, agent_id, tenant_id, status, rental_codes!inner(assisted_by_agent_id)")
      .eq("id", claimId)
      .maybeSingle();
    if (claimError) return { ok: false, error: claimError.message };
    if (!claim) return { ok: false, error: "Claim not found." };
    if (claim.status !== "pending") {
      return { ok: false, error: "Claim has already been reviewed." };
    }

    const rentalJoin = claim.rental_codes as { assisted_by_agent_id?: string } | { assisted_by_agent_id?: string }[] | null;
    const assistedAgentId = Array.isArray(rentalJoin)
      ? rentalJoin[0]?.assisted_by_agent_id
      : rentalJoin?.assisted_by_agent_id;
    const isAdmin = isAdminRole(profile.role);
    const isAssistedAgent = assistedAgentId === profile.id;
    if (!isAdmin && !isAssistedAgent) {
      return { ok: false, error: "Only an admin or the assisting agent can review this claim." };
    }

    const { error: updateError } = await supabase
      .from("rental_marketing_claims")
      .update({
        status: decision,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        reject_reason: decision === "rejected" ? rejectReason || null : null,
      })
      .eq("id", claimId);
    if (updateError) return { ok: false, error: updateError.message };

    if (decision === "approved") {
      // Link the claimant into the rental_marketing_agents junction
      // so they receive their share of marketing earnings per existing
      // payout logic. Use admin client to avoid RLS friction.
      const adminClient = createSupabaseAdminClient();
      await adminClient
        .from("rental_marketing_agents")
        .insert({
          tenant_id: claim.tenant_id,
          rental_id: claim.rental_id,
          agent_id: claim.agent_id,
        })
        .select("id")
        .maybeSingle();
    }

    await supabase.from("activity_log").insert({
      tenant_id: profile.tenant_id,
      actor_user_id: profile.id,
      action: decision === "approved" ? "marketing_claim_approved" : "marketing_claim_rejected",
      entity_type: "rental",
      entity_id: claim.rental_id,
      metadata: { claim_id: claimId },
    });

    revalidatePath(`/rentals/${claim.rental_id}`);
    revalidatePath("/earnings", "layout");
    return { ok: true };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    console.error("[reviewMarketingClaim] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
