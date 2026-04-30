import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { templates, type CommunicationRequestEmailContext } from "./render";
import { sendAgencyEmail } from "./agency-send";
import { type Agency } from "./branding";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  email_change: "Email change",
  alternative_format: "Alternative format",
  data_access: "Data access (GDPR)",
  other: "Other request",
};

function summarisePayload(requestType: string, payload: Record<string, unknown>): string {
  switch (requestType) {
    case "email_change": {
      const cur = String(payload.current_email ?? "");
      const req = String(payload.requested_email ?? "");
      return `Current: ${cur}\nRequested: ${req}`;
    }
    case "alternative_format": {
      const fmt = String(payload.format ?? "");
      const notes = String(payload.notes ?? "").trim();
      return `Format: ${fmt}${notes ? `\nNotes: ${notes}` : ""}`;
    }
    case "data_access": {
      const notes = String(payload.notes ?? "").trim();
      return notes || "Tenant requested a copy of their reminder history.";
    }
    case "other": {
      return String(payload.notes ?? "").trim();
    }
    default:
      return "";
  }
}

/**
 * Resolve the recipient address for system notifications: prefer the agency's
 * configured reply-to (admin-monitored), then fall back to any admin user's
 * auth email so the notification doesn't disappear.
 */
async function resolveAgencyRecipient(agency: Agency): Promise<string | null> {
  if (agency.branding.reply_to_email) return agency.branding.reply_to_email;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("id, role")
    .eq("tenant_id", agency.id)
    .in("role", ["admin", "super_admin"])
    .limit(1)
    .maybeSingle();
  if (!data?.id) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(data.id as string);
  return authUser?.user?.email ?? null;
}

export type NotifyAgencyParams = {
  agency: Agency;
  pmTenantName: string;
  propertyAddress: string;
  requestId: string;
  requestType: string;
  payload: Record<string, unknown>;
};

export async function notifyAgencyOfRequest(params: NotifyAgencyParams): Promise<void> {
  const recipient = await resolveAgencyRecipient(params.agency);
  if (!recipient) {
    console.error("[email] no agency recipient for notification", { agencyId: params.agency.id });
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://harborops.co.uk";
  const requestUrl = `${appUrl.replace(/\/$/, "")}/inbox/${params.requestId}`;

  const requestTypeLabel = REQUEST_TYPE_LABELS[params.requestType] ?? params.requestType;
  const ctx: CommunicationRequestEmailContext = {
    agency: {
      name: params.agency.name,
      logo_url: params.agency.branding.logo_url,
      primary_color: params.agency.branding.primary_color,
      accent_color: params.agency.branding.accent_color,
    },
    tenant: { name: params.pmTenantName },
    property: { address: params.propertyAddress },
    requestTypeLabel,
    summary: summarisePayload(params.requestType, params.payload),
    requestUrl,
  };

  const html = templates.communicationRequest(ctx);
  const text = [
    `New ${requestTypeLabel} request from ${params.pmTenantName}`,
    params.propertyAddress ? `Property: ${params.propertyAddress}` : "",
    "",
    ctx.summary,
    "",
    `Review: ${requestUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendAgencyEmail({
    agency: params.agency,
    to: recipient,
    subject: `New request from ${params.pmTenantName} - ${requestTypeLabel}`,
    html,
    text,
  });
}
