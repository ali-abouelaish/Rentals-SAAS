"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { notifyMarketingClaim } from "@/lib/email/notify-marketing-claim";

const ALLOWED_PROOF_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PROOF_FILES = 8;

export type ClaimResult = {
  ok: boolean;
  partial?: boolean;
  claimId?: string;
  error?: string;
};

/**
 * Marketing claim — an agent (typically a marketing-only agent)
 * asserts they did the marketing on this rental, attaching proof
 * screenshots. Sends a notification to assisting agent, admins,
 * and any already-linked marketing agents.
 */
export async function claimRentalAsMarketing(formData: FormData): Promise<ClaimResult> {
  try {
    const supabase = createSupabaseServerClient();
    const profile = await requireUserProfile();
    const rentalId = String(formData.get("rental_id") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    const proofFiles = (formData.getAll("proof") as File[]).filter((f) => f && f.size > 0);

    if (!rentalId) return { ok: false, error: "Missing rental id." };
    if (proofFiles.length < 1) {
      return { ok: false, error: "Attach at least one screenshot or PDF as proof." };
    }
    if (proofFiles.length > MAX_PROOF_FILES) {
      return { ok: false, error: `Attach at most ${MAX_PROOF_FILES} files.` };
    }
    for (const file of proofFiles) {
      if (file.size > MAX_PROOF_BYTES) {
        return { ok: false, error: `"${file.name}" is larger than 10 MB.` };
      }
      if (file.type && !ALLOWED_PROOF_MIME.has(file.type)) {
        return { ok: false, error: `"${file.name}" has an unsupported file type.` };
      }
    }

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

    let uploadFailed: string | null = null;
    try {
      for (const file of proofFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${profile.tenant_id}/${rental.id}/marketing_claim/${claim.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("rental_docs")
          .upload(filePath, file, { contentType: file.type || undefined });
        if (uploadError) throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);

        const { error: proofInsertError } = await supabase
          .from("rental_marketing_claim_proofs")
          .insert({
            tenant_id: profile.tenant_id,
            claim_id: claim.id,
            file_path: filePath,
            file_name: file.name,
          });
        if (proofInsertError) throw new Error(proofInsertError.message);
      }
    } catch (err) {
      uploadFailed = err instanceof Error ? err.message : "Proof upload failed";
      console.error("[marketing-claim] proof upload failed", err);
    }

    await supabase.from("activity_log").insert({
      tenant_id: profile.tenant_id,
      actor_user_id: profile.id,
      action: "marketing_claim_created",
      entity_type: "rental",
      entity_id: rental.id,
      metadata: { claim_id: claim.id, rental_code: rental.code },
    });

    await notifyMarketingClaim(claim.id);

    revalidatePath(`/rentals/${rentalId}`);
    revalidatePath("/rentals");

    if (uploadFailed) {
      return { ok: false, partial: true, claimId: claim.id, error: uploadFailed };
    }
    return { ok: true, claimId: claim.id };
  } catch (err) {
    console.error("[claimRentalAsMarketing] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
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
    console.error("[reviewMarketingClaim] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
