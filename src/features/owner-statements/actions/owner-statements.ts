"use server";

import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { loadAgencyBrand } from "@/lib/branding/agency-brand";
import { loadAgencyContactEmail } from "@/lib/email/contact";
import { logEmailSendError } from "@/lib/email/error-log";
import { formatAmount, templates } from "@/lib/email/render";
import { monthLabel } from "../domain/derive";
import {
  adjustmentLineSchema,
  feeOverrideSchema,
  ADJUSTMENT_DIRECTION,
  type AdjustmentLineInput,
  type FeeOverrideInput,
} from "../domain/types";
import {
  generateStatementForOwner,
  recomputeChainFrom,
  recomputeStatement,
  renderAndStoreStatementPdf,
  STATEMENTS_BUCKET,
} from "../lib/generate";

const EDITABLE = new Set(["draft", "approved"]);

/** Statements live under their owner, so both routes need revalidating. */
function revalidateStatement(ownerId: string, statementId: string) {
  revalidatePath("/owners");
  revalidatePath(`/owners/${ownerId}`);
  revalidatePath(`/owners/${ownerId}/statements/${statementId}`);
}

/** Generate (or regenerate) a statement for an owner + period; returns its id. */
export async function generateOwnerStatement(ownerId: string, year: number, month: number) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const result = await generateStatementForOwner(admin, {
    tenantId: profile.tenant_id,
    ownerId,
    year,
    month,
    createdBy: profile.id,
  });
  revalidateStatement(ownerId, result.statementId);
  return result.statementId;
}

/** Refresh the derived lines (rent, works, fee) on an existing draft statement. */
export async function regenerateOwnerStatement(statementId: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { data: st, error } = await admin
    .from("owner_statements")
    .select("owner_id, tenant_id, period_year, period_month, status")
    .eq("id", statementId)
    .single();
  if (error || !st || st.tenant_id !== profile.tenant_id) throw new Error("Statement not found.");
  if (!EDITABLE.has(st.status as string)) {
    throw new Error("This statement can no longer be regenerated.");
  }
  await generateStatementForOwner(admin, {
    tenantId: st.tenant_id as string,
    ownerId: st.owner_id as string,
    year: st.period_year as number,
    month: st.period_month as number,
    createdBy: profile.id,
  });
  revalidateStatement(st.owner_id as string, statementId);
}

/**
 * Set (or clear) the management fee for one statement.
 *
 * Passing type `null` clears the override and returns to the landlord's
 * standing deal. `apply_to_default` also writes the new figure back to the
 * landlord for future periods; statements already sent are never touched.
 */
export async function setStatementFeeOverride(
  input: FeeOverrideInput & { clear?: boolean }
) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const { data: st, error } = await admin
    .from("owner_statements")
    .select("id, tenant_id, owner_id, period_year, period_month, status")
    .eq("id", input.statement_id)
    .single();
  if (error || !st || st.tenant_id !== profile.tenant_id) throw new Error("Statement not found.");
  if (!EDITABLE.has(st.status as string)) throw new Error("This statement can no longer be edited.");

  if (input.clear) {
    const { error: clearErr } = await admin
      .from("owner_statements")
      .update({
        fee_override_type: null,
        fee_override_percent: null,
        fee_override_amount: null,
        fee_override_by: null,
        fee_override_at: null,
      })
      .eq("id", st.id);
    if (clearErr) throw new Error(clearErr.message);
  } else {
    const parsed = feeOverrideSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid input.");
    const v = parsed.data;

    const { error: updErr } = await admin
      .from("owner_statements")
      .update({
        fee_override_type: v.type,
        fee_override_percent: v.type === "percent" ? v.percent ?? null : null,
        fee_override_amount: v.type === "flat" ? v.amount ?? null : null,
        fee_override_by: profile.id,
        fee_override_at: new Date().toISOString(),
      })
      .eq("id", st.id);
    if (updErr) throw new Error(updErr.message);

    if (v.apply_to_default) {
      const { error: ownerErr } = await admin
        .from("owner_landlords")
        .update({
          management_fee_type: v.type,
          management_fee_percent: v.type === "percent" ? v.percent ?? null : null,
          management_fee_amount: v.type === "flat" ? v.amount ?? null : null,
        })
        .eq("id", st.owner_id as string)
        .eq("tenant_id", profile.tenant_id);
      if (ownerErr) throw new Error(ownerErr.message);
    }
  }

  // Re-derive so the fee line and every total pick up the new figure.
  await generateStatementForOwner(admin, {
    tenantId: st.tenant_id as string,
    ownerId: st.owner_id as string,
    year: st.period_year as number,
    month: st.period_month as number,
    createdBy: profile.id,
  });
  revalidateStatement(st.owner_id as string, st.id as string);
}

/**
 * Include or exclude a maintenance cost from owner statements.
 *
 * The flag lives on the cost itself, so this is the same switch the maintenance
 * job form exposes — there is only one source of truth for "does the owner pay
 * for this". The statement is then re-derived so the line appears or vanishes.
 */
export async function setCostRechargeable(
  statementId: string,
  costId: string,
  rechargeable: boolean
) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const { data: st, error } = await admin
    .from("owner_statements")
    .select("id, tenant_id, owner_id, period_year, period_month, status")
    .eq("id", statementId)
    .single();
  if (error || !st || st.tenant_id !== profile.tenant_id) throw new Error("Statement not found.");
  if (!EDITABLE.has(st.status as string)) throw new Error("This statement can no longer be edited.");

  const { error: updErr } = await admin
    .from("maintenance_costs")
    .update({ recharge_to_owner: rechargeable })
    .eq("id", costId)
    .eq("tenant_id", profile.tenant_id);
  if (updErr) throw new Error(updErr.message);

  await generateStatementForOwner(admin, {
    tenantId: st.tenant_id as string,
    ownerId: st.owner_id as string,
    year: st.period_year as number,
    month: st.period_month as number,
    createdBy: profile.id,
  });
  revalidateStatement(st.owner_id as string, statementId);
}

/** Add a manual adjustment line to a draft statement. */
export async function addAdjustmentLine(input: AdjustmentLineInput) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = adjustmentLineSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input.");
  }
  const v = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: st, error } = await admin
    .from("owner_statements")
    .select("id, tenant_id, owner_id, status")
    .eq("id", v.statement_id)
    .single();
  if (error || !st || st.tenant_id !== profile.tenant_id) throw new Error("Statement not found.");
  if (!EDITABLE.has(st.status as string)) throw new Error("This statement can no longer be edited.");

  const { error: insErr } = await admin.from("owner_transactions").insert({
    tenant_id: st.tenant_id,
    owner_id: st.owner_id,
    property_id: v.property_id ?? null,
    contract_id: null,
    statement_id: v.statement_id,
    txn_date: v.txn_date,
    type: v.type,
    direction: ADJUSTMENT_DIRECTION[v.type],
    amount_pence: Math.round(v.amount * 100),
    category: "manual",
    description: v.description,
    source_kind: "manual",
    source_id: null,
    reconciled: false,
    is_manual: true,
    created_by: profile.id,
  });
  if (insErr) throw new Error(insErr.message);

  await recomputeStatement(admin, v.statement_id);
  revalidateStatement(st.owner_id as string, v.statement_id);
}

/** Delete a manual adjustment line from a draft statement. */
export async function deleteOwnerTransaction(transactionId: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const { data: txn, error } = await admin
    .from("owner_transactions")
    .select("id, tenant_id, owner_id, statement_id, is_manual")
    .eq("id", transactionId)
    .single();
  if (error || !txn || txn.tenant_id !== profile.tenant_id) throw new Error("Line not found.");
  if (!txn.is_manual) {
    throw new Error("Only manual lines can be deleted. Regenerate to refresh derived lines.");
  }

  const { data: st } = await admin
    .from("owner_statements")
    .select("status")
    .eq("id", txn.statement_id)
    .single();
  if (st && !EDITABLE.has(st.status as string)) {
    throw new Error("This statement can no longer be edited.");
  }

  const { error: delErr } = await admin
    .from("owner_transactions")
    .delete()
    .eq("id", transactionId);
  if (delErr) throw new Error(delErr.message);

  if (txn.statement_id) {
    await recomputeStatement(admin, txn.statement_id as string);
    revalidateStatement(txn.owner_id as string, txn.statement_id as string);
  }
}

/** Email the statement PDF to the owner and mark it sent. */
export async function sendOwnerStatement(statementId: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const { data: st, error } = await admin
    .from("owner_statements")
    .select("*, owner:owner_landlords(name, email)")
    .eq("id", statementId)
    .single();
  if (error || !st || st.tenant_id !== profile.tenant_id) throw new Error("Statement not found.");
  if (st.status === "void") throw new Error("Cannot send a void statement.");

  const recipient = (st.owner as { email: string | null } | null)?.email ?? "";
  if (!recipient) throw new Error("This owner has no email address on file.");

  if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY.");
  const fromDomain = process.env.EMAIL_FROM_DOMAIN;
  if (!fromDomain) throw new Error("EMAIL_FROM_DOMAIN is not set.");

  // Ensure the PDF exists, then download it for the attachment.
  let path = st.pdf_storage_path as string | null;
  if (!path) path = await renderAndStoreStatementPdf(admin, statementId);
  const { data: pdfFile } = await admin.storage.from(STATEMENTS_BUCKET).download(path);
  if (!pdfFile) throw new Error("Unable to fetch statement PDF.");
  const buffer = Buffer.from(await pdfFile.arrayBuffer());

  // Same brand resolution the PDF uses, so the covering email and the
  // attachment carry the same logo and colours.
  const brand = await loadAgencyBrand(st.tenant_id as string);
  const fromName = brand?.displayName || "Harbor Ops";
  const replyTo = await loadAgencyContactEmail(st.tenant_id as string);

  const periodLabel = monthLabel(st.period_year as number, st.period_month as number);
  const ownerName = (st.owner as { name: string } | null)?.name ?? "Landlord";
  const subject = `Statement — ${periodLabel}`;
  const filename = `statement-${st.period_year}-${String(st.period_month).padStart(2, "0")}.pdf`;

  const html = templates.ownerStatement({
    agency: {
      name: fromName,
      logo_url: brand?.branding.logo_url ?? null,
      primary_color: brand?.branding.primary_color ?? "#0F172A",
      accent_color: brand?.branding.accent_color ?? "#3B82F6",
      footer_address: brand?.branding.footer_address ?? "",
    },
    owner: { name: ownerName },
    periodLabel,
    netAmount: formatAmount(Number(st.net_to_owner_pence ?? 0) / 100),
    rentAmount: formatAmount(Number(st.total_rent_received_pence ?? 0) / 100),
    closingAmount: formatAmount(Number(st.closing_balance_pence ?? 0) / 100),
  });

  // Raw Resend rather than the sendEmail dispatcher: EmailMessage has no
  // attachments field, so a statement cannot go through the per-tenant
  // Graph/Gmail/SMTP transports until that is plumbed through.
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: `${fromName} <noreply@${fromDomain}>`,
      to: recipient,
      reply_to: replyTo,
      subject,
      html,
      attachments: [{ filename, content: buffer }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmailSendError({
      tenantId: st.tenant_id as string,
      message,
      context: { path: "owner-statement-send", statementId, to: recipient, subject },
    });
    throw err;
  }

  const { error: updErr } = await admin
    .from("owner_statements")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", statementId);
  if (updErr) throw new Error(updErr.message);

  revalidateStatement(st.owner_id as string, statementId);
}

/**
 * Void a statement, then re-chain the ones after it.
 *
 * Void statements are skipped when the next period looks up its opening
 * balance, so voiding mid-chain changes every later statement's starting
 * figure. Those are recomputed here rather than left stale (sent ones are
 * skipped — see recomputeChainFrom).
 */
export async function voidOwnerStatement(statementId: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { data: st, error } = await admin
    .from("owner_statements")
    .select("id, tenant_id, owner_id, period_year, period_month")
    .eq("id", statementId)
    .single();
  if (error || !st || st.tenant_id !== profile.tenant_id) throw new Error("Statement not found.");

  const { error: updErr } = await admin
    .from("owner_statements")
    .update({ status: "void" })
    .eq("id", statementId);
  if (updErr) throw new Error(updErr.message);

  await recomputeChainFrom(
    admin,
    st.tenant_id as string,
    st.owner_id as string,
    st.period_year as number,
    st.period_month as number
  );

  revalidateStatement(st.owner_id as string, statementId);
}

/** Regenerate the PDF if needed, then redirect to a short-lived signed URL. */
export async function viewOwnerStatementPdf(statementId: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { data: st, error } = await admin
    .from("owner_statements")
    .select("id, tenant_id, pdf_storage_path")
    .eq("id", statementId)
    .single();
  if (error || !st || st.tenant_id !== profile.tenant_id) throw new Error("Statement not found.");

  let path = st.pdf_storage_path as string | null;
  if (!path) path = await renderAndStoreStatementPdf(admin, statementId);

  const { data, error: signErr } = await admin.storage
    .from(STATEMENTS_BUCKET)
    .createSignedUrl(path, 3600);
  if (signErr || !data?.signedUrl) {
    throw new Error(signErr?.message ?? "Unable to generate PDF link.");
  }
  redirect(data.signedUrl);
}
