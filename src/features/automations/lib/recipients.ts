// Recipient-address resolution, run at DISPATCH time (not queue time) so the
// address is fresh and opt-outs recorded after queueing are still honoured.
// The rendered body stays a queue-time snapshot; only the address is live.

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MessageChannel, ScheduledMessageRow } from "../domain/types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type RecipientResolution =
  | { ok: true; address: string | null; pmTenantId?: string }
  | { ok: false; permanent: boolean; reason: string };

type ResolvableRow = Pick<
  ScheduledMessageRow,
  | "tenant_id"
  | "channel"
  | "recipient_kind"
  | "recipient_resolver"
  | "recipient_value"
  | "assignee_user_id"
  | "related_entity_type"
  | "related_entity_id"
>;

function one<T>(rel: unknown): T | null {
  if (Array.isArray(rel)) return (rel[0] ?? null) as T | null;
  return (rel ?? null) as T | null;
}

function pickAddress(
  channel: MessageChannel,
  contact: { email: string | null; phone: string | null },
  who: string
): RecipientResolution {
  const address = channel === "sms" ? contact.phone : contact.email;
  if (!address) {
    return {
      ok: false,
      permanent: true,
      reason: `${who} has no ${channel === "sms" ? "phone number" : "email"} on file`,
    };
  }
  return { ok: true, address };
}

export async function resolveRecipient(
  admin: Admin,
  row: ResolvableRow
): Promise<RecipientResolution> {
  if (row.channel === "in_app") {
    // Delivery for in_app is visibility in the reminders inbox; no address.
    return { ok: true, address: null };
  }

  if (row.recipient_kind === "literal") {
    if (!row.recipient_value) {
      return { ok: false, permanent: true, reason: "Literal recipient has no address" };
    }
    return { ok: true, address: row.recipient_value };
  }

  if (row.recipient_kind === "staff") {
    return { ok: false, permanent: true, reason: "Staff recipients only support in_app" };
  }

  if (!row.related_entity_id) {
    return { ok: false, permanent: true, reason: "Resolver recipient has no related entity" };
  }

  switch (row.recipient_resolver) {
    case "tenancy_renter": {
      let pmTenantId: string | null = null;
      if (row.related_entity_type === "pm_tenant") {
        pmTenantId = row.related_entity_id;
      } else if (row.related_entity_type === "tenancy") {
        const { data, error } = await admin
          .from("property_contracts")
          .select("pm_tenant_id")
          .eq("id", row.related_entity_id)
          .eq("tenant_id", row.tenant_id)
          .maybeSingle();
        if (error) return { ok: false, permanent: false, reason: error.message };
        pmTenantId = (data?.pm_tenant_id as string | null) ?? null;
      } else {
        return {
          ok: false,
          permanent: true,
          reason: "tenancy_renter resolver needs a tenancy or tenant entity",
        };
      }
      if (!pmTenantId) {
        return { ok: false, permanent: true, reason: "Tenancy has no renter attached" };
      }

      const { data: pm, error: pmErr } = await admin
        .from("pm_tenants")
        .select("id, email, phone, email_status, reminders_enabled")
        .eq("id", pmTenantId)
        .eq("tenant_id", row.tenant_id)
        .maybeSingle();
      if (pmErr) return { ok: false, permanent: false, reason: pmErr.message };
      if (!pm) return { ok: false, permanent: true, reason: "Renter not found" };
      if (!pm.reminders_enabled) {
        return { ok: false, permanent: true, reason: "Renter has reminders disabled" };
      }
      if (row.channel === "email" && pm.email_status !== "active") {
        return {
          ok: false,
          permanent: true,
          reason: `Renter email status is ${pm.email_status}`,
        };
      }
      const picked = pickAddress(
        row.channel,
        { email: pm.email as string | null, phone: pm.phone as string | null },
        "Renter"
      );
      if (!picked.ok) return picked;
      return { ...picked, pmTenantId: pm.id as string };
    }

    case "property_owner": {
      let ownerId: string | null = null;
      if (row.related_entity_type === "owner") {
        ownerId = row.related_entity_id;
      } else if (row.related_entity_type === "property") {
        const { data, error } = await admin
          .from("properties")
          .select("owner_landlord_id")
          .eq("id", row.related_entity_id)
          .eq("tenant_id", row.tenant_id)
          .maybeSingle();
        if (error) return { ok: false, permanent: false, reason: error.message };
        ownerId = (data?.owner_landlord_id as string | null) ?? null;
      } else {
        return {
          ok: false,
          permanent: true,
          reason: "property_owner resolver needs a property or owner entity",
        };
      }
      if (!ownerId) {
        return { ok: false, permanent: true, reason: "Property has no owner landlord" };
      }

      const { data: owner, error } = await admin
        .from("owner_landlords")
        .select("email, phone")
        .eq("id", ownerId)
        .eq("tenant_id", row.tenant_id)
        .maybeSingle();
      if (error) return { ok: false, permanent: false, reason: error.message };
      if (!owner) return { ok: false, permanent: true, reason: "Owner landlord not found" };
      return pickAddress(
        row.channel,
        { email: owner.email as string | null, phone: owner.phone as string | null },
        "Owner"
      );
    }

    case "works_order_contractor": {
      if (row.related_entity_type !== "works_order") {
        return {
          ok: false,
          permanent: true,
          reason: "works_order_contractor resolver needs a works order entity",
        };
      }
      const { data, error } = await admin
        .from("maintenance_jobs")
        .select("supplier:maintenance_suppliers(email, phone)")
        .eq("id", row.related_entity_id)
        .eq("tenant_id", row.tenant_id)
        .maybeSingle();
      if (error) return { ok: false, permanent: false, reason: error.message };
      if (!data) return { ok: false, permanent: true, reason: "Works order not found" };
      const supplier = one<{ email: string | null; phone: string | null }>(data.supplier);
      if (!supplier) {
        return { ok: false, permanent: true, reason: "Works order has no contractor assigned" };
      }
      return pickAddress(row.channel, supplier, "Contractor");
    }

    case "certificate_issuer": {
      if (row.related_entity_type !== "certificate") {
        return {
          ok: false,
          permanent: true,
          reason: "certificate_issuer resolver needs a certificate entity",
        };
      }
      const { data, error } = await admin
        .from("certificates")
        .select("contractor:maintenance_suppliers(email, phone)")
        .eq("id", row.related_entity_id)
        .eq("tenant_id", row.tenant_id)
        .maybeSingle();
      if (error) return { ok: false, permanent: false, reason: error.message };
      if (!data) return { ok: false, permanent: true, reason: "Certificate not found" };
      const contractor = one<{ email: string | null; phone: string | null }>(data.contractor);
      if (!contractor) {
        return { ok: false, permanent: true, reason: "Certificate has no contractor on file" };
      }
      return pickAddress(row.channel, contractor, "Contractor");
    }

    default:
      return { ok: false, permanent: true, reason: "Unknown recipient resolver" };
  }
}
