// Preset rule library — one click away from a working rule, so a new agency
// is not staring at a blank rule builder. Presets are created switched OFF;
// the recommended path is dry-run first, then live.

import type { RecipientConfig } from "./types";
import type { RepeatConfig, RuleCondition, TriggerConfig } from "./rules";

export type RulePreset = {
  key: string;
  name: string;
  description: string;
  triggerConfig: TriggerConfig;
  conditions: RuleCondition[];
  repeatConfig: RepeatConfig | null;
  channel: "email" | "in_app";
  templateKey: string;
  /** null → in_app preset assigned to the creating user (editable after). */
  recipient: RecipientConfig | null;
  sendHour: number;
};

const RENTER: RecipientConfig = { kind: "resolver", resolver: "tenancy_renter" };
const CONTRACTOR: RecipientConfig = { kind: "resolver", resolver: "works_order_contractor" };
const CERT_ISSUER: RecipientConfig = { kind: "resolver", resolver: "certificate_issuer" };

export const RULE_PRESETS: RulePreset[] = [
  {
    key: "rent_due_3d",
    name: "Rent due in 3 days",
    description: "Emails the tenant three days before their monthly rent date.",
    triggerConfig: { kind: "date_offset", field: "tenancy.rent_due_date", offset_days: 3, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "email",
    templateKey: "rent_due_upcoming",
    recipient: RENTER,
    sendHour: 9,
  },
  {
    key: "rent_due_today",
    name: "Rent due today",
    description: "Emails the tenant on the morning their rent is due.",
    triggerConfig: { kind: "date_offset", field: "tenancy.rent_due_date", offset_days: 0, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "email",
    templateKey: "rent_due_today",
    recipient: RENTER,
    sendHour: 9,
  },
  {
    key: "arrears_3d",
    name: "Arrears — 3 days",
    description: "Emails the tenant when rent is 3 days overdue and unpaid.",
    triggerConfig: { kind: "threshold", metric: "arrears_days", gte: 3 },
    conditions: [],
    repeatConfig: null,
    channel: "email",
    templateKey: "rent_overdue",
    recipient: RENTER,
    sendHour: 9,
  },
  {
    key: "arrears_7d",
    name: "Arrears — 1 week",
    description: "Emails the tenant when rent is 7 days overdue and unpaid.",
    triggerConfig: { kind: "threshold", metric: "arrears_days", gte: 7 },
    conditions: [],
    repeatConfig: null,
    channel: "email",
    templateKey: "rent_overdue",
    recipient: RENTER,
    sendHour: 9,
  },
  {
    key: "arrears_14d",
    name: "Arrears — 2 weeks",
    description: "Emails the tenant when rent is 14 days overdue and unpaid.",
    triggerConfig: { kind: "threshold", metric: "arrears_days", gte: 14 },
    conditions: [],
    repeatConfig: null,
    channel: "email",
    templateKey: "rent_overdue",
    recipient: RENTER,
    sendHour: 9,
  },
  {
    key: "rtr_expiry_60",
    name: "Right-to-rent expiry — 60 days",
    description: "Internal reminder 60 days before a tenant's right-to-rent check expires.",
    triggerConfig: { kind: "date_offset", field: "pm_tenant.right_to_rent_expiry", offset_days: 60, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "in_app",
    templateKey: "right_to_rent_expiry",
    recipient: null,
    sendHour: 9,
  },
  {
    key: "rtr_expiry_30",
    name: "Right-to-rent expiry — 30 days",
    description: "Internal reminder 30 days before a tenant's right-to-rent check expires.",
    triggerConfig: { kind: "date_offset", field: "pm_tenant.right_to_rent_expiry", offset_days: 30, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "in_app",
    templateKey: "right_to_rent_expiry",
    recipient: null,
    sendHour: 9,
  },
  {
    key: "rtr_expiry_7",
    name: "Right-to-rent expiry — 7 days",
    description: "Internal reminder a week before a tenant's right-to-rent check expires.",
    triggerConfig: { kind: "date_offset", field: "pm_tenant.right_to_rent_expiry", offset_days: 7, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "in_app",
    templateKey: "right_to_rent_expiry",
    recipient: null,
    sendHour: 9,
  },
  {
    key: "owner_expiry_60",
    name: "Owner contract expiry — 60 days",
    description: "Internal reminder 60 days before an owner landlord's contract expires.",
    triggerConfig: { kind: "date_offset", field: "owner.contract_expiry_date", offset_days: 60, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "in_app",
    templateKey: "owner_contract_expiry",
    recipient: null,
    sendHour: 9,
  },
  {
    key: "owner_expiry_30",
    name: "Owner contract expiry — 30 days",
    description: "Internal reminder 30 days before an owner landlord's contract expires.",
    triggerConfig: { kind: "date_offset", field: "owner.contract_expiry_date", offset_days: 30, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "in_app",
    templateKey: "owner_contract_expiry",
    recipient: null,
    sendHour: 9,
  },
  {
    key: "tenancy_end_90",
    name: "Tenancy ending — 90 days",
    description: "Internal reminder 90 days before a tenancy's end date.",
    triggerConfig: { kind: "date_offset", field: "tenancy.expiry_date", offset_days: 90, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "in_app",
    templateKey: "tenancy_ending",
    recipient: null,
    sendHour: 9,
  },
  {
    key: "tenancy_end_60",
    name: "Tenancy ending — 60 days",
    description: "Internal reminder 60 days before a tenancy's end date.",
    triggerConfig: { kind: "date_offset", field: "tenancy.expiry_date", offset_days: 60, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "in_app",
    templateKey: "tenancy_ending",
    recipient: null,
    sendHour: 9,
  },
  {
    key: "works_order_chase",
    name: "Works order chase",
    description:
      "Emails the contractor when a works order has been open for more than 7 days, and again every 3 days until it's resolved.",
    triggerConfig: { kind: "threshold", metric: "works_order_open_days", gte: 7 },
    conditions: [],
    repeatConfig: { every_days: 3, until_cleared: true },
    channel: "email",
    templateKey: "works_order_chase",
    recipient: CONTRACTOR,
    sendHour: 10,
  },
  {
    key: "cert_expiry_agency_30",
    name: "Certificate expiry — 30 days (internal)",
    description:
      "Internal reminder 30 days before a compliance certificate (gas safety, EICR, EPC…) expires.",
    triggerConfig: { kind: "date_offset", field: "certificate.expiry_date", offset_days: 30, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "in_app",
    templateKey: "certificate_expiry_agency",
    recipient: null,
    sendHour: 9,
  },
  {
    key: "cert_expiry_contractor_30",
    name: "Certificate renewal chase — 30 days",
    description:
      "Emails the contractor who issued a certificate 30 days before it expires, asking them to book the renewal.",
    triggerConfig: { kind: "date_offset", field: "certificate.expiry_date", offset_days: 30, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "email",
    templateKey: "certificate_renewal_contractor",
    recipient: CERT_ISSUER,
    sendHour: 10,
  },
  {
    key: "cert_expiry_contractor_7",
    name: "Certificate renewal chase — 7 days",
    description:
      "Follow-up email to the issuing contractor a week before a certificate expires, if it still hasn't been renewed.",
    triggerConfig: { kind: "date_offset", field: "certificate.expiry_date", offset_days: 7, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "email",
    templateKey: "certificate_renewal_contractor",
    recipient: CERT_ISSUER,
    sendHour: 10,
  },
  {
    key: "cert_expired_agency",
    name: "Certificate expired (internal)",
    description:
      "Internal alert on the day a compliance certificate expires — the property is out of compliance.",
    triggerConfig: { kind: "date_offset", field: "certificate.expiry_date", offset_days: 0, direction: "before" },
    conditions: [],
    repeatConfig: null,
    channel: "in_app",
    templateKey: "certificate_expired_agency",
    recipient: null,
    sendHour: 9,
  },
];

export function presetByKey(key: string): RulePreset | undefined {
  return RULE_PRESETS.find((p) => p.key === key);
}
