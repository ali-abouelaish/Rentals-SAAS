"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { loadAgency } from "@/lib/email/agency-context";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import { templates, buildContext, renderPlainText } from "@/lib/email/render";

export type SendNowResult =
  | { ok: true; kind: "rent_due" | "rent_overdue"; daysOverdue: number; sentTo: string }
  | { ok: false; error: string };

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

/**
 * Manually send the right rent-reminder email for a tenant, deciding the
 * variant (rent-due vs rent-overdue) from the live contract + payment state.
 * Always recomputes server-side; never trusts a client-supplied kind.
 */
export async function sendRentReminderNow(pmTenantId: string): Promise<SendNowResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const { data: pm, error: pmErr } = await admin
    .from("pm_tenants")
    .select("id, full_name, email, email_status, reminders_enabled, tenant_id")
    .eq("id", pmTenantId)
    .maybeSingle();
  if (pmErr) return { ok: false, error: pmErr.message };
  if (!pm) return { ok: false, error: "Tenant not found." };
  if (pm.tenant_id !== profile.tenant_id) return { ok: false, error: "Tenant not found." };
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

  // Most recent collection date that's <= today.
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

  // If the contract hasn't started yet, the next collection date is in the
  // future and we should send a "rent due soon" notice rather than overdue.
  let daysOverdue = 0;
  let kind: "rent_due" | "rent_overdue" = "rent_due";

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
    if (!payment && daysOverdue > 0) kind = "rent_overdue";
  }

  const unitRel = contract.unit as unknown;
  const unitObj = Array.isArray(unitRel) ? (unitRel[0] ?? null) : (unitRel ?? null);
  const propertyRel = (unitObj as { property?: unknown } | null)?.property ?? null;
  const propertyObj = Array.isArray(propertyRel) ? (propertyRel[0] ?? null) : propertyRel;
  const propertyAddress = buildAddress(
    propertyObj as { address_line_1: string; address_line_2: string | null; postcode: string | null } | null
  );

  const agency = await loadAgency(profile.tenant_id);
  if (!agency) return { ok: false, error: "Agency not found." };

  const ctx = buildContext({
    branding: agency.branding,
    agencyName: agency.name || agency.branding.from_display_name,
    pmTenantName: pm.full_name as string,
    pmTenantId: pm.id as string,
    propertyAddress,
    amountPence: Number(contract.rent_pcm),
    dueDate,
    daysOverdue: kind === "rent_overdue" ? daysOverdue : undefined,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://harborops.co.uk",
  });

  const html = kind === "rent_overdue" ? templates.rentOverdue(ctx) : templates.rentDue(ctx);
  const text = renderPlainText(kind === "rent_overdue" ? "overdue" : "due", ctx);
  const subject =
    kind === "rent_overdue"
      ? `Rent overdue: ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`
      : daysOverdue === 0
        ? "Rent reminder: payment due today"
        : "Rent reminder: payment due soon";

  try {
    const { providerId } = await sendAgencyEmail({
      agency,
      to: pm.email as string,
      subject,
      html,
      text,
      pmTenantId: pm.id as string,
    });

    // Best-effort log entry; failures here don't block success since the mail
    // already went out. Use a 'manual_<kind>' reminder_type so the existing
    // CHECK constraint isn't tripped — which it would be — so instead we
    // pick the closest existing window and log under that. Falling back to
    // an upsert with onConflict prevents unique-constraint errors when the
    // cron has already logged this period.
    const reminderType =
      kind === "rent_overdue"
        ? daysOverdue >= 14
          ? "overdue_14d"
          : daysOverdue >= 7
            ? "overdue_7d"
            : "overdue_3d"
        : daysOverdue === 0
          ? "due_today"
          : "upcoming_3d";

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

    return { ok: true, kind, daysOverdue, sentTo: pm.email as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] manual rent reminder send failed", { pmTenantId, error: message });
    return { ok: false, error: message };
  }
}
