"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { loadAgency } from "@/lib/email/agency-context";
import { sendEmail } from "@/lib/email/send";
import { templates, buildContext, renderPlainText } from "@/lib/email/render";

export type ReminderKind = "rent_due" | "rent_overdue";

export type SendNowResult =
  | { ok: true; kind: ReminderKind; daysOverdue: number; sentTo: string }
  | { ok: false; error: string };

export type ReminderPreviewResult =
  | {
      ok: true;
      sentTo: string;
      suggestedKind: ReminderKind;
      daysOverdue: number;
      defaultBody: Record<ReminderKind, string>;
    }
  | { ok: false; error: string };

export type SendNowOptions = {
  kind?: ReminderKind;
  customBody?: string;
};

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function diffDays(later: Date, earlier: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const a = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const b = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((a - b) / ms);
}

function buildAddress(
  property: { address_line_1: string; address_line_2: string | null; postcode: string | null } | null
): string {
  if (!property) return "";
  return [property.address_line_1, property.address_line_2, property.postcode]
    .filter(Boolean)
    .join(", ");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function customBodyToHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px 0;line-height:1.5;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;">${paragraphs}</div>`;
}

function subjectFor(kind: ReminderKind, daysOverdue: number): string {
  if (kind === "rent_overdue") {
    return `Rent overdue: ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`;
  }
  return daysOverdue === 0
    ? "Rent reminder: payment due today"
    : "Rent reminder: payment due soon";
}

type ResolvedContext = {
  pm: { id: string; full_name: string; email: string; tenant_id: string };
  contract: { id: string };
  ctx: Parameters<typeof templates.rentDue>[0];
  suggestedKind: ReminderKind;
  daysOverdue: number;
  dueDate: Date;
};

async function resolveReminderContext(
  pmTenantId: string,
  profileTenantId: string
): Promise<{ ok: true; data: ResolvedContext } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();

  const { data: pm, error: pmErr } = await admin
    .from("pm_tenants")
    .select("id, full_name, email, email_status, reminders_enabled, tenant_id")
    .eq("id", pmTenantId)
    .maybeSingle();
  if (pmErr) return { ok: false, error: pmErr.message };
  if (!pm) return { ok: false, error: "Tenant not found." };
  if (pm.tenant_id !== profileTenantId) return { ok: false, error: "Tenant not found." };
  if (!pm.email) return { ok: false, error: "Tenant has no email on file." };
  if (pm.email_status !== "active") {
    return { ok: false, error: `Tenant email status is ${pm.email_status}. Cannot send.` };
  }

  const { data: contract, error: contractErr } = await admin
    .from("property_contracts")
    .select(`
      id, start_date, rent_pcm, collection_date, status,
      unit:units(
        property:properties(address_line_1, address_line_2, postcode)
      )
    `)
    .eq("pm_tenant_id", pmTenantId)
    .in("status", ["active", "signed", "notice_given"])
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (contractErr) return { ok: false, error: contractErr.message };
  if (!contract) return { ok: false, error: "No active contract for this tenant." };
  if (!contract.collection_date) {
    return {
      ok: false,
      error: "Set a rent collection date (1-31) on the contract before sending reminders.",
    };
  }

  const today = new Date();
  let dueYear = today.getFullYear();
  let dueMonthIdx = today.getMonth();
  if (today.getDate() < contract.collection_date) {
    dueMonthIdx -= 1;
    if (dueMonthIdx < 0) {
      dueMonthIdx = 11;
      dueYear -= 1;
    }
  }
  const dueDay = Math.min(contract.collection_date, daysInMonth(dueYear, dueMonthIdx));
  const dueDate = new Date(dueYear, dueMonthIdx, dueDay);
  const startDate = new Date(contract.start_date);

  let daysOverdue = 0;
  let suggestedKind: ReminderKind = "rent_due";

  if (dueDate >= startDate) {
    const periodYear = dueYear;
    const periodMonth = dueMonthIdx + 1;

    const { data: payment } = await admin
      .from("rent_payments")
      .select("id")
      .eq("contract_id", contract.id)
      .eq("period_year", periodYear)
      .eq("period_month", periodMonth)
      .maybeSingle();

    daysOverdue = diffDays(today, dueDate);
    if (!payment && daysOverdue > 0) suggestedKind = "rent_overdue";
  }

  const unitRel = contract.unit as unknown;
  const unitObj = Array.isArray(unitRel) ? (unitRel[0] ?? null) : (unitRel ?? null);
  const propertyRel = (unitObj as { property?: unknown } | null)?.property ?? null;
  const propertyObj = Array.isArray(propertyRel) ? (propertyRel[0] ?? null) : propertyRel;
  const propertyAddress = buildAddress(
    propertyObj as { address_line_1: string; address_line_2: string | null; postcode: string | null } | null
  );

  const agency = await loadAgency(profileTenantId);
  if (!agency) return { ok: false, error: "Agency not found." };

  const ctx = buildContext({
    branding: agency.branding,
    agencyName: agency.name || agency.branding.from_display_name,
    pmTenantName: pm.full_name as string,
    pmTenantId: pm.id as string,
    propertyAddress,
    amountPence: Number(contract.rent_pcm),
    dueDate,
    daysOverdue: suggestedKind === "rent_overdue" ? daysOverdue : undefined,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://harborops.co.uk",
  });

  return {
    ok: true,
    data: {
      pm: {
        id: pm.id as string,
        full_name: pm.full_name as string,
        email: pm.email as string,
        tenant_id: pm.tenant_id as string,
      },
      contract: { id: contract.id as string },
      ctx,
      suggestedKind,
      daysOverdue,
      dueDate,
    },
  };
}

/**
 * Compute the default body for both reminder variants without sending. Used by
 * the UI to prefill the customisation dialog so the user starts from the same
 * copy the system would otherwise send automatically.
 */
export async function getRentReminderPreview(
  pmTenantId: string
): Promise<ReminderPreviewResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const resolved = await resolveReminderContext(pmTenantId, profile.tenant_id);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const dueCtx = { ...resolved.data.ctx, daysOverdue: undefined };
  const overdueCtx = {
    ...resolved.data.ctx,
    daysOverdue: Math.max(resolved.data.daysOverdue, 1),
  };

  return {
    ok: true,
    sentTo: resolved.data.pm.email,
    suggestedKind: resolved.data.suggestedKind,
    daysOverdue: resolved.data.daysOverdue,
    defaultBody: {
      rent_due: renderPlainText("due", dueCtx),
      rent_overdue: renderPlainText("overdue", overdueCtx),
    },
  };
}

/**
 * Manually send a rent-reminder email for a tenant. Caller may override the
 * variant (rent_due vs rent_overdue) and/or supply a custom body — when no
 * override is given, the variant is recomputed server-side from contract +
 * payment state.
 */
export async function sendRentReminderNow(
  pmTenantId: string,
  opts: SendNowOptions = {}
): Promise<SendNowResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const resolved = await resolveReminderContext(pmTenantId, profile.tenant_id);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const { pm, contract, ctx, suggestedKind, daysOverdue, dueDate } = resolved.data;

  const agency = await loadAgency(profile.tenant_id);
  if (!agency) return { ok: false, error: "Agency not found." };

  const kind: ReminderKind = opts.kind ?? suggestedKind;
  const reportedOverdue = kind === "rent_overdue" ? Math.max(daysOverdue, 1) : daysOverdue;

  const customBody = opts.customBody?.trim();
  const html = customBody
    ? customBodyToHtml(customBody)
    : kind === "rent_overdue"
      ? templates.rentOverdue({ ...ctx, daysOverdue: reportedOverdue })
      : templates.rentDue({ ...ctx, daysOverdue: undefined });
  const text = customBody
    ? customBody
    : renderPlainText(kind === "rent_overdue" ? "overdue" : "due", {
        ...ctx,
        daysOverdue: kind === "rent_overdue" ? reportedOverdue : undefined,
      });
  const subject = subjectFor(kind, reportedOverdue);

  const reminderType =
    kind === "rent_overdue"
      ? reportedOverdue >= 14
        ? "overdue_14d"
        : reportedOverdue >= 7
          ? "overdue_7d"
          : "overdue_3d"
      : reportedOverdue === 0
        ? "due_today"
        : "upcoming_3d";

  try {
    const { providerId } = await sendEmail(
      profile.tenant_id,
      {
        to: pm.email,
        subject,
        html,
        text,
        pmTenantId: pm.id,
        templateKey: reminderType,
      },
      { agency },
    );

    await admin.from("rent_reminder_log").upsert(
      {
        tenant_id: profile.tenant_id,
        contract_id: contract.id,
        pm_tenant_id: pm.id,
        reminder_type: reminderType,
        period_start: dueDate.toISOString().slice(0, 10),
        email_provider_id: providerId,
        status: "sent",
      },
      { onConflict: "contract_id,period_start,reminder_type", ignoreDuplicates: true }
    );

    revalidatePath(`/tenants/${pm.id}/reminders`);
    revalidatePath("/tenants");
    revalidatePath("/properties");

    return { ok: true, kind, daysOverdue: reportedOverdue, sentTo: pm.email };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] manual rent reminder send failed", { pmTenantId, error: message });
    return { ok: false, error: message };
  }
}
