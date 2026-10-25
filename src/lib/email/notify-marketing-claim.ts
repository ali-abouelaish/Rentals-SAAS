import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAgency } from "./agency-context";
import { sendAgencyEmail } from "./agency-send";
import { MissingContactEmailError } from "./contact";
import { getTenantAppUrl } from "./app-url";
import { button, esc, harborEmail, label, paragraph, quote, strong } from "./harbor";

function renderHtml(opts: {
  claimantName: string;
  rentalCode: string;
  proofCount: number;
  note: string | null;
  url: string;
}): string {
  const proofs = `${opts.proofCount} proof screenshot${opts.proofCount === 1 ? "" : "s"}`;
  return harborEmail({
    title: `Marketing claim on rental ${opts.rentalCode}`,
    preheader: `${opts.claimantName} claimed marketing on ${opts.rentalCode}.`,
    eyebrow: "Your workspace",
    headline: ["Marketing claim submitted.", `Rental ${opts.rentalCode}.`],
    html:
      paragraph(
        `${strong(opts.claimantName)} has claimed marketing on rental ${strong(opts.rentalCode)} with ${esc(proofs)} attached.`
      ) +
      (opts.note ? label("Their note") + quote(opts.note) : "") +
      button(opts.url, "Review claim"),
    footnote: "Sent to the admins of your Harbor workspace.",
  });
}

function renderText(opts: {
  claimantName: string;
  rentalCode: string;
  proofCount: number;
  note: string | null;
  url: string;
}): string {
  const lines = [
    `Marketing claim submitted`,
    ``,
    `${opts.claimantName} has claimed marketing on rental ${opts.rentalCode}.`,
    `Proof screenshots attached: ${opts.proofCount}`,
  ];
  if (opts.note) lines.push(``, `Note: ${opts.note}`);
  lines.push(``, `Review: ${opts.url}`);
  return lines.join("\n");
}

/**
 * Notify the assisting agent, all admins, and any already-linked
 * marketing agents that a marketing claim was raised on a rental.
 * Excludes the claimant themselves.
 */
export async function notifyMarketingClaim(claimId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    const { data: claim } = await admin
      .from("rental_marketing_claims")
      .select("id, tenant_id, rental_id, agent_id, note")
      .eq("id", claimId)
      .maybeSingle();
    if (!claim) return;

    const { data: rental } = await admin
      .from("rental_codes")
      .select("id, code, assisted_by_agent_id")
      .eq("id", claim.rental_id)
      .maybeSingle();
    if (!rental) return;

    const [{ data: claimant }, { data: admins }, { data: linkedMkt }, { count: proofCount }] = await Promise.all([
      admin
        .from("user_profiles")
        .select("display_name")
        .eq("id", claim.agent_id)
        .maybeSingle(),
      admin
        .from("user_profiles")
        .select("id")
        .eq("tenant_id", claim.tenant_id)
        .in("role", ["admin", "super_admin"]),
      admin
        .from("rental_marketing_agents")
        .select("agent_id")
        .eq("rental_id", claim.rental_id),
      admin
        .from("rental_marketing_claim_proofs")
        .select("id", { count: "exact", head: true })
        .eq("claim_id", claim.id),
    ]);

    const recipientIds = new Set<string>();
    if (rental.assisted_by_agent_id) recipientIds.add(rental.assisted_by_agent_id);
    (admins ?? []).forEach((a) => a.id && recipientIds.add(a.id as string));
    (linkedMkt ?? []).forEach((row) => row.agent_id && recipientIds.add(row.agent_id as string));
    recipientIds.delete(claim.agent_id);

    if (recipientIds.size === 0) return;

    const userIds = Array.from(recipientIds);
    const emailsByUser = new Map<string, string>();
    await Promise.all(
      userIds.map(async (uid) => {
        const { data: authUser } = await admin.auth.admin.getUserById(uid);
        const email = authUser?.user?.email;
        if (email) emailsByUser.set(uid, email);
      })
    );

    if (emailsByUser.size === 0) return;

    const agency = await loadAgency(claim.tenant_id);
    if (!agency) {
      console.warn("[notify-marketing-claim] agency not found", { tenantId: claim.tenant_id });
      return;
    }

    const url = await getTenantAppUrl(claim.tenant_id, `/rentals/${rental.id}`);
    const html = renderHtml({
      claimantName: claimant?.display_name ?? "An agent",
      rentalCode: rental.code ?? "—",
      proofCount: proofCount ?? 0,
      note: (claim.note as string | null) ?? null,
      url,
    });
    const text = renderText({
      claimantName: claimant?.display_name ?? "An agent",
      rentalCode: rental.code ?? "—",
      proofCount: proofCount ?? 0,
      note: (claim.note as string | null) ?? null,
      url,
    });
    const subject = `Marketing claim on rental ${rental.code ?? ""}`.trim();

    await Promise.all(
      Array.from(emailsByUser.values()).map(async (to) => {
        try {
          await sendAgencyEmail({ agency, to, subject, html, text });
        } catch (err) {
          if (err instanceof MissingContactEmailError) return;
          console.error("[notify-marketing-claim] send failed", { to, err });
        }
      })
    );
  } catch (err) {
    console.error("[notify-marketing-claim] failed", err);
  }
}
