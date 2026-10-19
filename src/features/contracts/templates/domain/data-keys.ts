import type { FieldFormat, FieldSource } from "./types";

export type DataKeyOption = {
  source: FieldSource;
  key: string;
  label: string;
  hint?: string;
  /** Applied when the key is picked, so a rent field prints "£650" not "650". */
  defaultFormat?: FieldFormat;
};

/** Sources whose fields bind through a whitelisted data_key. */
export const DATA_KEY_SOURCES: readonly FieldSource[] = [
  "property",
  "unit",
  "landlord",
  "agency",
  "booking",
  "pm_tenant",
  "computed",
  "contract",
];

export function isDataKeySource(source: FieldSource | null | undefined): boolean {
  return !!source && DATA_KEY_SOURCES.includes(source);
}

// Whitelist of allowed data_key paths per source. Shared by the resolver
// (which reads these to fetch values) and the binding-picker UI.
export const DATA_KEY_OPTIONS: DataKeyOption[] = [
  // ── contract (the terms entered when the PDF is generated) ──
  { source: "contract", key: "contract.start_date",      label: "Tenancy start date", defaultFormat: "date" },
  { source: "contract", key: "contract.expiry_date",     label: "Tenancy end date",   defaultFormat: "date", hint: "Blank for a rolling tenancy" },
  { source: "contract", key: "contract.rent_pcm",        label: "Monthly rent",       defaultFormat: "currency_gbp" },
  { source: "contract", key: "contract.deposit",         label: "Deposit",            defaultFormat: "currency_gbp" },
  { source: "contract", key: "contract.collection_date", label: "Rent due day",       hint: "Day of the month rent is collected" },
  { source: "contract", key: "contract.deposit_scheme",  label: "Deposit scheme" },

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
  { source: "unit",     key: "unit.min_price_pcm",       label: "Min listing price PCM", defaultFormat: "currency_gbp", hint: "The advertised range, not the agreed rent — use Contract → Monthly rent for that" },
  { source: "unit",     key: "unit.max_price_pcm",       label: "Max listing price PCM", defaultFormat: "currency_gbp", hint: "The advertised range, not the agreed rent — use Contract → Monthly rent for that" },
  { source: "unit",     key: "unit.deposit",             label: "Unit's standard deposit", defaultFormat: "currency_gbp", hint: "The unit's default, not this tenancy's deposit — use Contract → Deposit for that" },
  { source: "unit",     key: "unit.holding_deposit",     label: "Holding deposit", defaultFormat: "currency_gbp" },

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
  { source: "booking",  key: "booking.submitted_at",     label: "Booking submitted at", defaultFormat: "date" },

  // ── pm_tenant (the converted tenant record) ──────────────
  { source: "pm_tenant", key: "pm_tenant.full_name",       label: "Tenant full name" },
  { source: "pm_tenant", key: "pm_tenant.email",           label: "Tenant email" },
  { source: "pm_tenant", key: "pm_tenant.phone",           label: "Tenant phone" },
  { source: "pm_tenant", key: "pm_tenant.current_address", label: "Tenant current address", defaultFormat: "multiline" },

  // ── computed ─────────────────────────────────────────────
  { source: "computed", key: "computed.today",                       label: "Today's date", defaultFormat: "date" },
  { source: "computed", key: "computed.deposit_protection_deadline", label: "Deposit protection deadline (start + 30d)", defaultFormat: "date" },
  { source: "computed", key: "computed.contract_id",                 label: "Contract ID" },
  { source: "computed", key: "computed.standing_order_ref",          label: "Standing order reference", hint: "Reference the tenant puts on their rent standing order" },
];

export const DATA_KEY_SET = new Set(DATA_KEY_OPTIONS.map((o) => o.key));

export function isValidDataKey(source: FieldSource, key: string | null): boolean {
  if (!key) return false;
  return DATA_KEY_OPTIONS.some((o) => o.source === source && o.key === key);
}

export function defaultFormatForKey(key: string | null): FieldFormat | undefined {
  if (!key) return undefined;
  return DATA_KEY_OPTIONS.find((o) => o.key === key)?.defaultFormat;
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

/**
 * Manual keys that older templates (and the old AI detector) used for the
 * contract terms. Generation fills them from the terms the agent enters, so
 * the PDF and the contract record can never disagree, and the agent isn't
 * asked for the same date twice.
 */
export const TERM_MANUAL_KEYS = ["start_date", "expiry_date", "rent_pcm", "deposit"] as const;

export function isTermManualKey(key: string | null | undefined): boolean {
  return !!key && (TERM_MANUAL_KEYS as readonly string[]).includes(key);
}
