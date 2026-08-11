// Code-defined default message templates, lazily seeded per tenant (upsert on
// conflict do nothing) the first time the templates page or rule builder is
// opened — so future tenants get them without a backfill migration. Rows stay
// editable per agency; "Reset to default" restores the copy below. The rent
// copy mirrors the legacy renderPlainText bodies so the migrated rent rules
// read the same as the retired cron's emails.

import type { MessageChannel, TemplateEntityType } from "./types";

export type DefaultTemplate = {
  key: string;
  name: string;
  channel: MessageChannel;
  entityType: TemplateEntityType;
  subject: string | null;
  body: string;
};

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    key: "rent_due_upcoming",
    name: "Rent due soon",
    channel: "email",
    entityType: "tenancy",
    subject: "Rent reminder: payment due in 3 days",
    body: `Hi {{renter_name}},

This is a friendly reminder that rent of {{rent_amount}} is due on {{anchor_date}} for {{property_address}}.

If you have any questions, just reply to this email.

Thanks,
{{agency_name}}`,
  },
  {
    key: "rent_due_today",
    name: "Rent due today",
    channel: "email",
    entityType: "tenancy",
    subject: "Rent reminder: payment due today",
    body: `Hi {{renter_name}},

This is a friendly reminder that rent of {{rent_amount}} is due today ({{anchor_date}}) for {{property_address}}.

If you have any questions, just reply to this email.

Thanks,
{{agency_name}}`,
  },
  {
    key: "rent_overdue",
    name: "Rent overdue",
    channel: "email",
    entityType: "tenancy",
    subject: "Rent overdue: payment outstanding",
    body: `Hi {{renter_name}},

Your rent of {{rent_amount}} for {{property_address}} is now overdue (it was due on {{anchor_date}}).

Please make payment as soon as possible, or contact us if you need to discuss arrangements.

Thanks,
{{agency_name}}`,
  },
  {
    key: "rent_due_today_sms",
    name: "Rent due today (SMS)",
    channel: "sms",
    entityType: "tenancy",
    subject: null,
    body: "Hi {{renter_name}}, a reminder that your rent of {{rent_amount}} for {{property_address}} is due today. {{agency_name}}",
  },
  {
    key: "rent_overdue_sms",
    name: "Rent overdue (SMS)",
    channel: "sms",
    entityType: "tenancy",
    subject: null,
    body: "Hi {{renter_name}}, your rent of {{rent_amount}} for {{property_address}} is overdue (due {{anchor_date}}). Please pay as soon as possible. {{agency_name}}",
  },
  {
    key: "tenancy_ending",
    name: "Tenancy ending soon",
    channel: "in_app",
    entityType: "tenancy",
    subject: "Tenancy ending {{anchor_date}}",
    body: "The tenancy for {{renter_name}} at {{property_address}} ends on {{anchor_date}}. Decide on renewal, notice, or re-marketing.",
  },
  {
    key: "right_to_rent_expiry",
    name: "Right-to-rent expiring",
    channel: "in_app",
    entityType: "pm_tenant",
    subject: "Right-to-rent check expiring {{anchor_date}}",
    body: "The right-to-rent check for {{renter_name}} expires on {{anchor_date}}. Arrange a follow-up check before then.",
  },
  {
    key: "owner_contract_expiry",
    name: "Owner contract expiring",
    channel: "in_app",
    entityType: "owner",
    subject: "Owner contract expiring {{anchor_date}}",
    body: "The management contract with {{owner_name}} expires on {{anchor_date}}. Start the renewal conversation.",
  },
  {
    key: "works_order_chase",
    name: "Works order chase",
    channel: "email",
    entityType: "works_order",
    subject: "Checking in: {{job_title}}",
    body: `Hi {{supplier_name}},

Just checking in on "{{job_title}}" at {{property_address}} — it has been open for {{days_open}} days.

Could you give us a quick update on progress or an expected completion date?

Thanks,
{{agency_name}}`,
  },
  {
    key: "certificate_renewal_contractor",
    name: "Certificate renewal — contractor",
    channel: "email",
    entityType: "certificate",
    subject: "Renewal needed: {{certificate_type}} at {{property_address}}",
    body: `Hi {{contractor_name}},

The {{certificate_type}} you issued for {{property_address}} ({{certificate_reference}}) expires on {{anchor_date}}.

Could you book a renewal inspection before then and send us the new certificate?

Thanks,
{{agency_name}}`,
  },
  {
    key: "certificate_expiry_agency",
    name: "Certificate expiring (internal)",
    channel: "in_app",
    entityType: "certificate",
    subject: "{{certificate_type}} expiring {{anchor_date}}",
    body: "The {{certificate_type}} for {{property_address}} expires on {{anchor_date}} (ref {{certificate_reference}}, issued by {{contractor_name}}). Arrange the renewal and upload the new certificate.",
  },
  {
    key: "certificate_expired_agency",
    name: "Certificate expired (internal)",
    channel: "in_app",
    entityType: "certificate",
    subject: "{{certificate_type}} EXPIRED {{anchor_date}}",
    body: "The {{certificate_type}} for {{property_address}} expired on {{anchor_date}} — the property is out of compliance. Chase {{contractor_name}} and upload the replacement as soon as it arrives.",
  },
];
