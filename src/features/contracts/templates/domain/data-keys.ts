import type { FieldSource } from "./types";

export type DataKeyOption = {
  source: FieldSource;
  key: string;
  label: string;
  hint?: string;
};

// Whitelist of allowed data_key paths per source. Shared by the resolver
// (which reads these to fetch values) and the binding-picker UI.
export const DATA_KEY_OPTIONS: DataKeyOption[] = [
  // ── property ─────────────────────────────────────────────
  { source: "property", key: "property.name",            label: "Property name" },
  { source: "property", key: "property.address_line_1",  label: "Address line 1" },
  { source: "property", key: "property.address_line_2",  label: "Address line 2" },
  { source: "property", key: "property.postcode",        label: "Postcode" },
  { source: "property", key: "property.area",            label: "Area" },
  { source: "property", key: "property.property_type",   label: "Property type", hint: "hmo, studio, whole_flat" },
  { source: "property", key: "property.bills",           label: "Bills arrangement" },

  // ── unit ─────────────────────────────────────────────────
  { source: "unit",     key: "unit.room_number",         label: "Room number" },
  { source: "unit",     key: "unit.unit_type",           label: "Unit type" },
  { source: "unit",     key: "unit.min_price_pcm",       label: "Min price PCM" },
  { source: "unit",     key: "unit.max_price_pcm",       label: "Max price PCM" },
  { source: "unit",     key: "unit.deposit",             label: "Unit deposit" },
  { source: "unit",     key: "unit.holding_deposit",     label: "Holding deposit" },

  // ── landlord (owner_landlords joined via property.owner_landlord_id) ──
  { source: "landlord", key: "landlord.name",            label: "Landlord name" },
  { source: "landlord", key: "landlord.email",           label: "Landlord email" },
  { source: "landlord", key: "landlord.phone",           label: "Landlord phone" },

  // ── agency (tenants row) ─────────────────────────────────
  { source: "agency",   key: "agency.name",              label: "Agency name" },

  // ── booking (the application itself) ─────────────────────
  { source: "booking",  key: "booking.applicant_name",   label: "Applicant name" },
  { source: "booking",  key: "booking.applicant_email",  label: "Applicant email" },
  { source: "booking",  key: "booking.applicant_phone",  label: "Applicant phone" },
  { source: "booking",  key: "booking.submitted_at",     label: "Booking submitted at" },

  // ── pm_tenant (the converted tenant record) ──────────────
  { source: "pm_tenant", key: "pm_tenant.full_name",       label: "Tenant full name" },
  { source: "pm_tenant", key: "pm_tenant.email",           label: "Tenant email" },
  { source: "pm_tenant", key: "pm_tenant.phone",           label: "Tenant phone" },
  { source: "pm_tenant", key: "pm_tenant.current_address", label: "Tenant current address" },

  // ── computed ─────────────────────────────────────────────
  { source: "computed", key: "computed.today",                       label: "Today's date" },
  { source: "computed", key: "computed.deposit_protection_deadline", label: "Deposit protection deadline (start + 30d)" },
  { source: "computed", key: "computed.contract_id",                 label: "Contract ID" },
];

export const DATA_KEY_SET = new Set(DATA_KEY_OPTIONS.map((o) => o.key));

export function isValidDataKey(source: FieldSource, key: string | null): boolean {
  if (!key) return false;
  return DATA_KEY_OPTIONS.some((o) => o.source === source && o.key === key);
}

export const DATA_KEY_GROUPS: Record<string, DataKeyOption[]> = DATA_KEY_OPTIONS.reduce(
  (acc, opt) => {
    const group = opt.source;
    if (!acc[group]) acc[group] = [];
    acc[group].push(opt);
    return acc;
  },
  {} as Record<string, DataKeyOption[]>,
);
