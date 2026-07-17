import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/email/outbox";
import {
  generateTicketConfirmationEmail,
  generateTicketStatusChangeEmail,
  generateTicketCommentEmail,
  generateLandlordP0AlertEmail,
  generatePropertyManagerTicketEmail,
} from "@/lib/email/templates/maintenance";

function buildUnitLabel(unit: {
  unit_type: string;
  room_number: string | null;
  room_type: string | null;
}): string {
  if (unit.unit_type === "room") {
    const rn = unit.room_number ? `Room ${unit.room_number}` : "Room";
    const rt = unit.room_type
      ? ` · ${unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)}`
      : "";
    return `${rn}${rt}`;
  }
  return unit.unit_type === "studio" ? "Studio" : "Whole flat";
}

function buildAddress(p: {
  address_line_1: string;
  address_line_2: string | null;
  postcode: string | null;
  area: string | null;
}): string {
  return [p.address_line_1, p.address_line_2, p.area, p.postcode]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(", ");
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

async function loadTicketBundle(ticketId: string) {
  const admin = createSupabaseAdminClient();
  const { data: ticket } = await admin
    .from("maintenance_tickets")
    .select(
      "id, tenant_id, property_id, unit_id, pm_tenant_id, reference, description, priority"
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return null;

  const [{ data: company }, { data: property }, { data: unit }, { data: pmTenant }] =
    await Promise.all([
      admin
        .from("tenants")
        .select("id, name, slug, alert_email")
        .eq("id", ticket.tenant_id)
        .maybeSingle(),
      admin
        .from("properties")
        .select("address_line_1, address_line_2, postcode, area")
        .eq("id", ticket.property_id)
        .maybeSingle(),
      admin
        .from("units")
        .select("unit_type, room_number, room_type")
        .eq("id", ticket.unit_id)
        .maybeSingle(),
      admin
        .from("pm_tenants")
        .select("full_name, email, phone")
        .eq("id", ticket.pm_tenant_id)
        .maybeSingle(),
    ]);

  if (!company || !property || !unit || !pmTenant) return null;

  return {
    ticket: {
      id: ticket.id as string,
      tenantId: ticket.tenant_id as string,
      reference: ticket.reference as string,
      description: ticket.description as string,
      priority: ticket.priority as "critical" | "high" | "medium" | "low",
    },
    company: {
      name: company.name as string,
      slug: company.slug as string | null,
      alertEmail: company.alert_email as string | null,
    },
    propertyAddress: buildAddress({
      address_line_1: property.address_line_1 as string,
      address_line_2: (property.address_line_2 as string | null) ?? null,
      postcode: (property.postcode as string | null) ?? null,
      area: (property.area as string | null) ?? null,
    }),
    roomLabel: buildUnitLabel({
      unit_type: unit.unit_type as string,
      room_number: (unit.room_number as string | null) ?? null,
      room_type: (unit.room_type as string | null) ?? null,
    }),
    pmTenant: {
      fullName: pmTenant.full_name as string,
      email: pmTenant.email as string,
      phone: pmTenant.phone as string,
    },
  };
}

function buildTicketUrl(slug: string | null, ticketId: string): string | null {
  const portalDomain = process.env.APP_PORTAL_DOMAIN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (slug && portalDomain) {
    const host = portalDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${slug}.${host}/maintenance/${ticketId}`;
  }
  if (appUrl) {
    return `${appUrl.replace(/\/$/, "")}/maintenance/${ticketId}`;
  }
  return null;
}

/**
 * Queue a confirmation email to the tenant who raised the ticket.
 */
export async function sendTicketConfirmation(ticketId: string): Promise<void> {
  const bundle = await loadTicketBundle(ticketId);
  if (!bundle) {
    console.warn("[notifications.ticketConfirmation] ticket not found", ticketId);
    return;
  }

  const { subject, html, text } = generateTicketConfirmationEmail({
    reference: bundle.ticket.reference,
    tenantFirstName: firstNameOf(bundle.pmTenant.fullName),
    descriptionPreview: bundle.ticket.description,
    priority: bundle.ticket.priority,
    propertyAddress: bundle.propertyAddress,
    roomLabel: bundle.roomLabel,
  });

  await enqueueEmail({
    tenantId: bundle.ticket.tenantId,
    to: bundle.pmTenant.email,
    subject,
    html,
    text,
  });
}

/**
 * Queue a P0 emergency alert to the landlord (tenants.alert_email).
 */
export async function sendLandlordP0Alert(args: {
  ticketId: string;
  emergencyType: string;
}): Promise<void> {
  const bundle = await loadTicketBundle(args.ticketId);
  if (!bundle) {
    console.warn("[notifications.landlordP0Alert] ticket not found", args.ticketId);
    return;
  }

  if (!bundle.company.alertEmail) {
    console.warn(
      "[notifications.landlordP0Alert] tenant has no alert_email set",
      bundle.ticket.tenantId
    );
    return;
  }

  const ticketUrl = buildTicketUrl(bundle.company.slug, bundle.ticket.id);

  const { subject, html, text } = generateLandlordP0AlertEmail({
    reference: bundle.ticket.reference,
    emergencyType: args.emergencyType,
    propertyAddress: bundle.propertyAddress,
    roomLabel: bundle.roomLabel,
    pmTenantFullName: bundle.pmTenant.fullName,
    pmTenantPhone: bundle.pmTenant.phone,
    pmTenantEmail: bundle.pmTenant.email,
    descriptionPreview: bundle.ticket.description,
    ticketUrl,
  });

  await enqueueEmail({
    tenantId: bundle.ticket.tenantId,
    to: bundle.company.alertEmail,
    subject,
    html,
    text,
  });
}

/**
 * Queue a new-ticket notification to the property's assigned manager.
 * Looks up manager_landlord via properties.manager_landlord_id. No-op if the
 * property has no assigned manager or the manager row has no email.
 */
export async function sendPropertyManagerTicketNotification(args: {
  ticketId: string;
  isEmergency: boolean;
  emergencyType: string | null;
}): Promise<void> {
  const bundle = await loadTicketBundle(args.ticketId);
  if (!bundle) {
    console.warn("[notifications.pmTicket] ticket not found", args.ticketId);
    return;
  }

  const admin = createSupabaseAdminClient();
  const { data: ticketRow } = await admin
    .from("maintenance_tickets")
    .select("property_id")
    .eq("id", args.ticketId)
    .maybeSingle();
  if (!ticketRow?.property_id) return;

  const { data: property } = await admin
    .from("properties")
    .select("manager_landlord_id")
    .eq("id", ticketRow.property_id)
    .maybeSingle();
  if (!property?.manager_landlord_id) {
    console.warn(
      "[notifications.pmTicket] property has no manager_landlord assigned",
      ticketRow.property_id
    );
    return;
  }

  const { data: manager } = await admin
    .from("manager_landlords")
    .select("full_name, email")
    .eq("id", property.manager_landlord_id)
    .maybeSingle();
  if (!manager?.email) {
    console.warn(
      "[notifications.pmTicket] manager_landlord has no email",
      property.manager_landlord_id
    );
    return;
  }

  const ticketUrl = buildTicketUrl(bundle.company.slug, bundle.ticket.id);

  const { subject, html, text } = generatePropertyManagerTicketEmail({
    reference: bundle.ticket.reference,
    priority: bundle.ticket.priority,
    propertyAddress: bundle.propertyAddress,
    roomLabel: bundle.roomLabel,
    pmTenantFullName: bundle.pmTenant.fullName,
    pmTenantPhone: bundle.pmTenant.phone,
    pmTenantEmail: bundle.pmTenant.email,
    managerFirstName: manager.full_name ? firstNameOf(manager.full_name) : null,
    descriptionPreview: bundle.ticket.description,
    ticketUrl,
    isEmergency: args.isEmergency,
    emergencyType: args.emergencyType,
  });

  await enqueueEmail({
    tenantId: bundle.ticket.tenantId,
    to: manager.email,
    subject,
    html,
    text,
  });
}

/**
 * Queue an email to the tenant when staff comment on their ticket.
 * No-op if the pm_tenant has no email on record.
 */
export async function sendTicketCommentNotification(args: {
  ticketId: string;
  authorName: string;
  commentBody: string;
}): Promise<void> {
  const bundle = await loadTicketBundle(args.ticketId);
  if (!bundle) {
    console.warn("[notifications.ticketComment] ticket not found", args.ticketId);
    return;
  }
  if (!bundle.pmTenant.email) {
    console.warn(
      "[notifications.ticketComment] pm_tenant has no email",
      args.ticketId
    );
    return;
  }

  const { subject, html, text } = generateTicketCommentEmail({
    reference: bundle.ticket.reference,
    tenantFirstName: firstNameOf(bundle.pmTenant.fullName),
    authorName: args.authorName,
    agencyName: bundle.company.name,
    commentBody: args.commentBody,
    descriptionPreview: bundle.ticket.description,
  });

  await enqueueEmail({
    tenantId: bundle.ticket.tenantId,
    to: bundle.pmTenant.email,
    subject,
    html,
    text,
  });
}

/**
 * Queue a status-change email to the tenant. Returns early if the newStatus has
 * no tenant-facing copy (e.g. open, pending_parts, pending_quote).
 */
export async function sendTicketStatusChange(args: {
  ticketId: string;
  oldStatus: string;
  newStatus: string;
}): Promise<void> {
  const bundle = await loadTicketBundle(args.ticketId);
  if (!bundle) {
    console.warn("[notifications.statusChange] ticket not found", args.ticketId);
    return;
  }

  const email = generateTicketStatusChangeEmail({
    reference: bundle.ticket.reference,
    tenantFirstName: firstNameOf(bundle.pmTenant.fullName),
    descriptionPreview: bundle.ticket.description,
    oldStatus: args.oldStatus,
    newStatus: args.newStatus,
  });
  if (!email) return;

  await enqueueEmail({
    tenantId: bundle.ticket.tenantId,
    to: bundle.pmTenant.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
