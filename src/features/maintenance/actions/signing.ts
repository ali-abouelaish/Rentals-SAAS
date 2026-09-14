"use server";

// Sending a works order to its contractor for signature.
//
// Kept out of actions/index.ts so the maintenance module doesn't pull the
// BoldSign client and @react-pdf/renderer into every action import.

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { isBoldSignConfigured } from "@/lib/boldsign/config";
import type { SendForSignatureActionResult } from "@/lib/boldsign/types";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { sendForSignature } from "@/lib/boldsign/send";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { buildWorksOrderDocument } from "../lib/worksOrderPdf";

export type WorksOrderSigningState = {
  /** False when the agency has not subscribed to the e-signing integration. */
  entitled: boolean;
  /** Null when nothing has been sent. */
  status: string | null;
  sentAt: string | null;
  completedAt: string | null;
  isSandbox: boolean;
};

/**
 * Send the works order to the assigned contractor for signature.
 *
 * Returns `{ error }` rather than throwing, matching the other maintenance
 * actions — the drawer surfaces it as a toast.
 */
export async function sendWorksOrderForSignature(
  jobId: string
): Promise<SendForSignatureActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);

  // The paid gate. Checked here and not only in the UI: a server action is a
  // public endpoint, and the panel that hides the button is client code.
  if (!(await hasFeature("e_signing"))) {
    return {
      error:
        "E-signing isn't active on your account. Activate it under Settings → Integrations.",
    };
  }

  if (!isBoldSignConfigured()) {
    return { error: "E-signing is not configured. Add a BoldSign API key first." };
  }

  let document;
  try {
    document = await buildWorksOrderDocument(profile.tenant_id, jobId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not build the works order." };
  }

  if (!document.contractor) {
    // The commonest reason a send fails, and one the user can fix — so say
    // exactly what to do rather than letting BoldSign reject it.
    return {
      error:
        "This work order has no contractor with an email address. Assign a supplier with an email, then send again.",
    };
  }

  const result = await sendForSignature({
    tenantId: profile.tenant_id,
    entityType: "work_order",
    entityId: jobId,
    title: `Works order ${document.reference} — ${document.title}`,
    message:
      `Please review and accept works order ${document.reference}. ` +
      `Signing confirms you will carry out the work at the costs stated.`,
    pdf: document.pdf,
    fileName: document.fileName,
    sentBy: profile.id,
    signers: [
      {
        name: document.contractor.name,
        email: document.contractor.email,
        fields: document.fields,
      },
    ],
  });

  // `code` is propagated so the panel can tell an out-of-envelopes failure
  // apart from every other kind — it opens the purchase dialog rather than
  // showing a toast, because it is the one the user can fix in place.
  if (!result.ok) return { error: result.error, code: result.code };

  revalidatePath("/maintenance");
  return { success: true, documentId: result.boldSignDocumentId };
}

/**
 * Current signing state for a works order, for the drawer to render.
 *
 * Read through the SSR client so RLS scopes it — this is display data, not a
 * privileged operation.
 */
export async function getWorksOrderSigningState(
  jobId: string
): Promise<WorksOrderSigningState> {
  await requireRole([...ADMIN_ROLES]);

  const entitled = await hasFeature("e_signing");
  const empty: WorksOrderSigningState = {
    entitled,
    status: null,
    sentAt: null,
    completedAt: null,
    isSandbox: false,
  };

  // Skip the query entirely when the agency can't use the feature — there is
  // nothing to show, and an unsubscribed agency shouldn't be paying a round
  // trip on every drawer open.
  if (!entitled) return empty;

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("boldsign_documents")
    .select("status, sent_at, completed_at, is_sandbox")
    .eq("entity_type", "work_order")
    .eq("entity_id", jobId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      status: string;
      sent_at: string | null;
      completed_at: string | null;
      is_sandbox: boolean;
    }>();

  if (error || !data) return empty;

  return {
    entitled,
    status: data.status,
    sentAt: data.sent_at,
    completedAt: data.completed_at,
    isSandbox: data.is_sandbox,
  };
}
