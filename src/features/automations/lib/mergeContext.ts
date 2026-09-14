// Merge-context building: one scoped query per entity type, returning only
// keys from the MERGE_FIELDS allowlist. Resolved at QUEUE time so the rendered
// message is a snapshot that cannot break if data changes before send.

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CERTIFICATE_TYPE_LABELS,
  type CertificateType,
} from "@/features/certificates/domain/types";
import type { MessageEntityType } from "../domain/types";
import { londonToday } from "./london";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MergeContextResult = {
  context: Record<string, string>;
  /** Short human label for the entity ("Jane Smith — 12 Harbour St"). */
  entityLabel: string;
};

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function fmtDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : DATE_FMT.format(d);
}

function fmtMoney(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : GBP.format(Number(value));
}

/**
 * Normalise a supabase to-one embed: the client types them as arrays but
 * returns objects for FK joins — accept either shape.
 */
function one<T>(rel: unknown): T | null {
  if (Array.isArray(rel)) return (rel[0] ?? null) as T | null;
  return (rel ?? null) as T | null;
}

type PropertyAddress = {
  address_line_1: string;
  address_line_2: string | null;
  postcode: string | null;
};

function buildAddress(p: PropertyAddress | null): string {
  if (!p) return "";
  return [p.address_line_1, p.address_line_2, p.postcode].filter(Boolean).join(", ");
}

/** Shared fields present on every message (with or without a related entity). */
export function sharedContext(agencyName: string, now: Date = new Date()): Record<string, string> {
  return {
    agency_name: agencyName,
    today: DATE_FMT.format(now),
  };
}

/**
 * Build the allowlisted merge context for one entity. Returns null when the
 * entity does not exist or belongs to a different tenant.
 */
export async function buildMergeContext(
  admin: Admin,
  opts: {
    tenantId: string;
    agencyName: string;
    entityType: MessageEntityType;
    entityId: string;
  }
): Promise<MergeContextResult | null> {
  const shared = sharedContext(opts.agencyName);

  switch (opts.entityType) {
    case "tenancy": {
      const { data, error } = await admin
        .from("property_contracts")
        .select(
          `id, start_date, expiry_date, rent_pcm, collection_date,
           pm_tenant:pm_tenants(full_name, email),
           unit:units(room_number, property:properties(address_line_1, address_line_2, postcode))`
        )
        .eq("id", opts.entityId)
        .eq("tenant_id", opts.tenantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const pm = one<{ full_name: string; email: string | null }>(data.pm_tenant);
      const unit = one<{ room_number: string | null; property: unknown }>(data.unit);
      const property = one<PropertyAddress>(unit?.property);
      const address = buildAddress(property);
      return {
        context: {
          ...shared,
          renter_name: pm?.full_name ?? "",
          renter_email: pm?.email ?? "",
          property_address: address,
          unit_name: unit?.room_number ?? "",
          rent_amount: fmtMoney(data.rent_pcm as number | null),
          rent_due_day: data.collection_date ? String(data.collection_date) : "",
          tenancy_start_date: fmtDate(data.start_date as string | null),
          tenancy_end_date: fmtDate(data.expiry_date as string | null),
        },
        entityLabel: [pm?.full_name, address].filter(Boolean).join(" — ") || "Tenancy",
      };
    }

    case "pm_tenant": {
      const { data, error } = await admin
        .from("pm_tenants")
        .select("full_name, email, phone, right_to_rent_expiry")
        .eq("id", opts.entityId)
        .eq("tenant_id", opts.tenantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        context: {
          ...shared,
          renter_name: (data.full_name as string) ?? "",
          renter_email: (data.email as string | null) ?? "",
          renter_phone: (data.phone as string | null) ?? "",
          right_to_rent_expiry: fmtDate(data.right_to_rent_expiry as string | null),
        },
        entityLabel: (data.full_name as string) || "Tenant",
      };
    }

    case "property": {
      const { data, error } = await admin
        .from("properties")
        .select(
          `address_line_1, address_line_2, postcode,
           owner_landlord:owner_landlords(name)`
        )
        .eq("id", opts.entityId)
        .eq("tenant_id", opts.tenantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const owner = one<{ name: string }>(data.owner_landlord);
      const address = buildAddress(data as unknown as PropertyAddress);
      return {
        context: {
          ...shared,
          property_address: address,
          owner_name: owner?.name ?? "",
        },
        entityLabel: address || "Property",
      };
    }

    case "unit": {
      const { data, error } = await admin
        .from("units")
        .select(
          `room_number, status,
           property:properties(address_line_1, address_line_2, postcode)`
        )
        .eq("id", opts.entityId)
        .eq("tenant_id", opts.tenantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const property = one<PropertyAddress>(data.property);
      const address = buildAddress(property);
      const unitName = (data.room_number as string | null) ?? "";
      return {
        context: {
          ...shared,
          unit_name: unitName,
          unit_status: (data.status as string) ?? "",
          property_address: address,
        },
        entityLabel: [unitName, address].filter(Boolean).join(" — ") || "Unit",
      };
    }

    case "works_order": {
      const { data, error } = await admin
        .from("maintenance_jobs")
        .select(
          `reference, title, status, created_at, scheduled_date,
           supplier:maintenance_suppliers(name),
           property:properties(address_line_1, address_line_2, postcode)`
        )
        .eq("id", opts.entityId)
        .eq("tenant_id", opts.tenantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const supplier = one<{ name: string }>(data.supplier);
      const property = one<PropertyAddress>(data.property);
      const createdAt = new Date(data.created_at as string);
      const daysOpen = Math.max(
        0,
        Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
      );
      return {
        context: {
          ...shared,
          works_order_ref: (data.reference as string) ?? "",
          job_title: (data.title as string) ?? "",
          job_status: ((data.status as string) ?? "").replace(/_/g, " "),
          supplier_name: supplier?.name ?? "",
          property_address: buildAddress(property),
          days_open: String(daysOpen),
          scheduled_date: fmtDate(data.scheduled_date as string | null),
        },
        entityLabel: [data.reference as string | null, data.title as string]
          .filter(Boolean)
          .join(" · ") || "Works order",
      };
    }

    case "owner": {
      const { data, error } = await admin
        .from("owner_landlords")
        .select("name, email, contract_start_date, contract_expiry_date, next_payment_due")
        .eq("id", opts.entityId)
        .eq("tenant_id", opts.tenantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        context: {
          ...shared,
          owner_name: (data.name as string) ?? "",
          owner_email: (data.email as string | null) ?? "",
          contract_start_date: fmtDate(data.contract_start_date as string | null),
          contract_expiry_date: fmtDate(data.contract_expiry_date as string | null),
          next_payment_due: fmtDate(data.next_payment_due as string | null),
        },
        entityLabel: (data.name as string) || "Owner",
      };
    }

    case "certificate": {
      const { data, error } = await admin
        .from("certificates")
        .select(
          `type, issue_date, expiry_date, reference,
           contractor:maintenance_suppliers(name),
           unit:units(room_number),
           property:properties(address_line_1, address_line_2, postcode)`
        )
        .eq("id", opts.entityId)
        .eq("tenant_id", opts.tenantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const contractor = one<{ name: string }>(data.contractor);
      const unit = one<{ room_number: string | null }>(data.unit);
      const property = one<PropertyAddress>(data.property);
      const address = buildAddress(property);
      const typeLabel =
        CERTIFICATE_TYPE_LABELS[data.type as CertificateType] ??
        String(data.type).replace(/_/g, " ");
      return {
        context: {
          ...shared,
          certificate_type: typeLabel,
          certificate_reference: (data.reference as string | null) ?? "",
          issue_date: fmtDate(data.issue_date as string | null),
          expiry_date: fmtDate(data.expiry_date as string | null),
          contractor_name: contractor?.name ?? "",
          property_address: address,
          unit_name: unit?.room_number ?? "",
        },
        entityLabel: [typeLabel, address].filter(Boolean).join(" — ") || "Certificate",
      };
    }
  }
}

export { londonToday };
