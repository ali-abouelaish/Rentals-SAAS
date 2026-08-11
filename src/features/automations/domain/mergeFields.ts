import type { MessageEntityType, TemplateEntityType } from "./types";

export type MergeField = {
  key: string;
  label: string;
  example: string;
};

/** Available on every message regardless of entity. */
export const SHARED_MERGE_FIELDS: MergeField[] = [
  { key: "agency_name", label: "Agency name", example: "Harbor Lettings" },
  { key: "today", label: "Today's date", example: "23 July 2026" },
];

/**
 * Only present on rule-generated messages: the date the rule fired about
 * (rent due date, expiry date, tenancy end date…).
 */
export const RULE_MERGE_FIELDS: MergeField[] = [
  { key: "anchor_date", label: "Trigger date", example: "1 August 2026" },
];

/**
 * The complete merge-field allowlist per entity type. Rendering only ever
 * substitutes keys from this map — anything else stays visible in the output
 * and is flagged as a warning in the template editor.
 */
export const MERGE_FIELDS: Record<Exclude<TemplateEntityType, "none">, MergeField[]> = {
  tenancy: [
    { key: "renter_name", label: "Renter name", example: "Jane Smith" },
    { key: "renter_email", label: "Renter email", example: "jane@example.com" },
    { key: "property_address", label: "Property address", example: "12 Harbour St, SE1 2AB" },
    { key: "unit_name", label: "Room / unit", example: "Room 3" },
    { key: "rent_amount", label: "Monthly rent", example: "£950.00" },
    { key: "rent_due_day", label: "Rent due day of month", example: "1" },
    { key: "tenancy_start_date", label: "Tenancy start date", example: "1 February 2026" },
    { key: "tenancy_end_date", label: "Tenancy end date", example: "31 January 2027" },
  ],
  pm_tenant: [
    { key: "renter_name", label: "Renter name", example: "Jane Smith" },
    { key: "renter_email", label: "Renter email", example: "jane@example.com" },
    { key: "renter_phone", label: "Renter phone", example: "+44 7700 900123" },
    { key: "right_to_rent_expiry", label: "Right-to-rent expiry", example: "30 September 2026" },
  ],
  property: [
    { key: "property_address", label: "Property address", example: "12 Harbour St, SE1 2AB" },
    { key: "owner_name", label: "Owner name", example: "Alex Owner" },
  ],
  unit: [
    { key: "unit_name", label: "Room / unit", example: "Room 3" },
    { key: "unit_status", label: "Unit status", example: "occupied" },
    { key: "property_address", label: "Property address", example: "12 Harbour St, SE1 2AB" },
  ],
  works_order: [
    { key: "job_title", label: "Job title", example: "Boiler not heating" },
    { key: "job_status", label: "Job status", example: "in progress" },
    { key: "supplier_name", label: "Contractor name", example: "Ace Plumbing" },
    { key: "property_address", label: "Property address", example: "12 Harbour St, SE1 2AB" },
    { key: "days_open", label: "Days since reported", example: "9" },
    { key: "scheduled_date", label: "Scheduled date", example: "28 July 2026" },
  ],
  owner: [
    { key: "owner_name", label: "Owner name", example: "Alex Owner" },
    { key: "owner_email", label: "Owner email", example: "alex@example.com" },
    { key: "contract_start_date", label: "Contract start date", example: "1 March 2025" },
    { key: "contract_expiry_date", label: "Contract expiry date", example: "28 February 2027" },
    { key: "next_payment_due", label: "Next payment due", example: "1 August 2026" },
  ],
  certificate: [
    { key: "certificate_type", label: "Certificate type", example: "Gas Safety (CP12)" },
    { key: "certificate_reference", label: "Reference", example: "CP12-2026-0412" },
    { key: "issue_date", label: "Issue date", example: "12 August 2025" },
    { key: "expiry_date", label: "Expiry date", example: "12 August 2026" },
    { key: "contractor_name", label: "Contractor name", example: "Ace Gas Services" },
    { key: "property_address", label: "Property address", example: "12 Harbour St, SE1 2AB" },
    { key: "unit_name", label: "Room / unit", example: "Room 3" },
  ],
};

/** All fields usable for a given entity type (shared + entity-specific). */
export function mergeFieldsFor(entityType: TemplateEntityType | null): MergeField[] {
  if (!entityType || entityType === "none") return SHARED_MERGE_FIELDS;
  return [...SHARED_MERGE_FIELDS, ...MERGE_FIELDS[entityType]];
}

export function mergeKeysFor(entityType: TemplateEntityType | null): Set<string> {
  return new Set(mergeFieldsFor(entityType).map((f) => f.key));
}

export function isMessageEntityType(value: string): value is MessageEntityType {
  return ["property", "unit", "tenancy", "pm_tenant", "works_order", "owner", "certificate"].includes(value);
}
