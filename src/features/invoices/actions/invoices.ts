"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";
import { invoiceFromBonusesSchema, invoiceManualSchema } from "../domain/schemas";
import { InvoicePdf } from "../pdf/InvoicePdf";
import { formatGBP } from "@/lib/utils/formatters";

type InvoiceItemInput = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function computeTotals(items: InvoiceItemInput[]) {
  const normalized = items.map((item) => ({
    ...item,
    amount: roundMoney(item.quantity * item.rate)
  }));
  const subtotal = normalized.reduce((sum, item) => sum + item.amount, 0);
  return {
    items: normalized,
    subtotal: roundMoney(subtotal),
    total: roundMoney(subtotal),
    balanceDue: roundMoney(subtotal)
  };
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function createInvoiceManual(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const itemsRaw = String(formData.get("items") ?? "[]");
  const input = invoiceManualSchema.parse({
    billing_profile_id: formData.get("billing_profile_id"),
    landlord_id: formData.get("landlord_id"),
    issue_date: formData.get("issue_date") ?? undefined,
    payment_terms_days: formData.get("payment_terms_days") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    items: JSON.parse(itemsRaw)
  });

  const { data: billingProfile } = await supabase
    .from("billing_profiles")
    .select("default_payment_terms_days")
    .eq("id", input.billing_profile_id)
    .single();

  const paymentTermsDays =
    input.payment_terms_days ?? billingProfile?.default_payment_terms_days ?? 7;
  const issueDate = input.issue_date ? new Date(input.issue_date) : new Date();
  const dueDate = addDays(issueDate, paymentTermsDays);

  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "next_invoice_number",
    { p_tenant_id: profile.tenant_id }
  );
  if (numberError) throw new Error(numberError.message);

  const totals = computeTotals(input.items);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      billing_profile_id: input.billing_profile_id,
      landlord_id: input.landlord_id,
      invoice_number: invoiceNumber,
      issue_date: issueDate.toISOString().slice(0, 10),
      payment_terms_days: paymentTermsDays,
      due_date: dueDate.toISOString().slice(0, 10),
      status: "draft",
      created_by_user_id: profile.id,
      notes: input.notes ?? null,
      subtotal: totals.subtotal,
      total: totals.total,
      balance_due: totals.balanceDue
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const items = totals.items.map((item, index) => ({
    tenant_id: profile.tenant_id,
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount,
    sort_order: index
  }));
  const { error: itemError } = await supabase.from("invoice_items").insert(items);
  if (itemError) throw new Error(itemError.message);

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function createInvoiceFromBonuses(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const bonusIdsRaw = String(formData.get("bonus_ids") ?? "[]");
  const input = invoiceFromBonusesSchema.parse({
    bonus_ids: JSON.parse(bonusIdsRaw),
    billing_profile_id: formData.get("billing_profile_id"),
    issue_date: formData.get("issue_date") ?? undefined,
    payment_terms_days: formData.get("payment_terms_days") ?? undefined
  });

  const { data: bonuses, error: bonusError } = await supabase
    .from("bonuses")
    .select("id, landlord_id, amount_owed, code, landlords(name, billing_address)")
    .in("id", input.bonus_ids);
  if (bonusError) throw new Error(bonusError.message);
  if (!bonuses || bonuses.length === 0) {
    throw new Error("No bonuses selected.");
  }

  const landlordId = bonuses[0].landlord_id;
  const allSame = bonuses.every((bonus) => bonus.landlord_id === landlordId);
  if (!allSame) {
    throw new Error("All selected bonuses must belong to the same landlord.");
  }

  const { data: billingProfile } = await supabase
    .from("billing_profiles")
    .select("default_payment_terms_days")
    .eq("id", input.billing_profile_id)
    .single();

  const paymentTermsDays =
    input.payment_terms_days ?? billingProfile?.default_payment_terms_days ?? 7;
  const issueDate = input.issue_date ? new Date(input.issue_date) : new Date();
  const dueDate = addDays(issueDate, paymentTermsDays);

  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "next_invoice_number",
    { p_tenant_id: profile.tenant_id }
  );
  if (numberError) throw new Error(numberError.message);

  const items = bonuses.map((bonus, index) => ({
    description: `Landlord Bonus - ${bonus.code ?? bonus.id} - Landlord: ${
      bonus.landlords?.name ?? "Landlord"
    } (${bonus.landlords?.billing_address ?? "Address"}) - Client: Unknown`,
    quantity: 1,
    rate: Number(bonus.amount_owed ?? 0),
    amount: Number(bonus.amount_owed ?? 0),
    sort_order: index
  }));

  const totals = computeTotals(items);
  const bonusCodes = bonuses.map((bonus) => bonus.code ?? bonus.id).join(", ");

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      billing_profile_id: input.billing_profile_id,
      landlord_id: landlordId,
      invoice_number: invoiceNumber,
      issue_date: issueDate.toISOString().slice(0, 10),
      payment_terms_days: paymentTermsDays,
      due_date: dueDate.toISOString().slice(0, 10),
      status: "draft",
      created_by_user_id: profile.id,
      notes: `Invoice generated from Landlord Bonuses: ${bonusCodes}`,
      subtotal: totals.subtotal,
      total: totals.total,
      balance_due: totals.balanceDue
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const itemRows = totals.items.map((item) => ({
    tenant_id: profile.tenant_id,
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount,
    sort_order: item.sort_order
  }));
  const { error: itemError } = await supabase.from("invoice_items").insert(itemRows);
  if (itemError) throw new Error(itemError.message);

  const linkRows = bonuses.map((bonus) => ({
    tenant_id: profile.tenant_id,
    invoice_id: invoice.id,
    bonus_id: bonus.id
  }));
  const { error: linkError } = await supabase.from("invoice_bonus_links").insert(linkRows);
  if (linkError) throw new Error(linkError.message);

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function submitInvoice(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("created_by_user_id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function approveInvoice(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_user_id: profile.id
    })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function approveAndSendInvoice(invoiceId: string) {
  await approveInvoice(invoiceId);
  const formData = new FormData();
  formData.set("invoice_id", invoiceId);
  await sendInvoice(formData);
}

export async function generateInvoicePdf(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  await requireRole(["admin"]);
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, landlords(*), billing_profiles(*), created_by:user_profiles!invoices_created_by_user_id_fkey(display_name)")
    .eq("id", invoiceId)
    .single();
  if (!invoice) throw new Error("Invoice not found.");

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoicePdf, { invoice, items: items ?? [] })
  );

  const path = `${invoice.tenant_id}/${invoice.id}/${invoice.invoice_number}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("invoices-pdf")
    .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ pdf_storage_path: path })
    .eq("id", invoiceId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/invoices/${invoiceId}`);
  return path;
}

function applyTemplate(input: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    input
  );
}

export async function sendInvoice(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const subjectInput = String(formData.get("subject") ?? "");
  const bodyInput = String(formData.get("body") ?? "");

  if (!invoiceId) throw new Error("Missing invoice id.");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, landlords(*), billing_profiles(*), created_by:user_profiles!invoices_created_by_user_id_fkey(display_name)")
    .eq("id", invoiceId)
    .single();
  if (!invoice) throw new Error("Invoice not found.");

  let pdfPath = invoice.pdf_storage_path;
  if (!pdfPath) {
    pdfPath = await generateInvoicePdf(invoiceId);
  }

  const { data: pdfFile } = await supabase.storage
    .from("invoices-pdf")
    .download(pdfPath);
  if (!pdfFile) throw new Error("Unable to fetch invoice PDF.");

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("key", "invoice_send")
    .single();

  const variables = {
    landlord_name: invoice.landlords?.name ?? "Landlord",
    invoice_number: invoice.invoice_number,
    balance_due: formatGBP(Number(invoice.balance_due)),
    due_date: invoice.due_date,
    billing_company: invoice.billing_profiles?.sender_company_name ?? ""
  };

  const subject = applyTemplate(
    subjectInput || template?.subject || `Invoice ${invoice.invoice_number}`,
    variables
  );
  const body = applyTemplate(
    bodyInput || template?.body || "Please find your invoice attached.",
    variables
  );

  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const buffer = Buffer.from(await pdfFile.arrayBuffer());
  await resend.emails.send({
    from: process.env.INVOICE_FROM_EMAIL ?? "invoices@example.com",
    to: invoice.landlords?.email ?? "",
    subject,
    html: `<p>${body}</p>`,
    attachments: [
      {
        filename: `${invoice.invoice_number}.pdf`,
        content: buffer
      }
    ]
  });

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (updateError) throw new Error(updateError.message);

  await supabase
    .from("bonuses")
    .update({ status: "sent" })
    .in(
      "id",
      (await supabase
        .from("invoice_bonus_links")
        .select("bonus_id")
        .eq("invoice_id", invoiceId)).data?.map((link) => link.bonus_id) ?? []
    );

  await supabase.from("activity_log").insert({
    tenant_id: invoice.tenant_id,
    actor_user_id: profile.id,
    action: "invoice_sent",
    entity_type: "invoice",
    entity_id: invoice.id,
    metadata: { invoice_number: invoice.invoice_number }
  });

  revalidatePath(`/invoices/${invoiceId}`);
}

export async function markInvoicePaid(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  await requireRole(["admin"]);

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);

  await supabase
    .from("bonuses")
    .update({ status: "paid" })
    .in(
      "id",
      (await supabase
        .from("invoice_bonus_links")
        .select("bonus_id")
        .eq("invoice_id", invoiceId)).data?.map((link) => link.bonus_id) ?? []
    );

  revalidatePath(`/invoices/${invoiceId}`);
}

export async function markInvoiceDeclined(invoiceId: string) {
  const supabase = createSupabaseServerClient();
  await requireRole(["admin"]);

  const { error } = await supabase
    .from("invoices")
    .update({ status: "declined", declined_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);

  await supabase
    .from("bonuses")
    .update({ status: "declined" })
    .in(
      "id",
      (await supabase
        .from("invoice_bonus_links")
        .select("bonus_id")
        .eq("invoice_id", invoiceId)).data?.map((link) => link.bonus_id) ?? []
    );

  revalidatePath(`/invoices/${invoiceId}`);
}
