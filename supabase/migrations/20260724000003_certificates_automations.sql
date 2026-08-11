-- Teach the messaging engine about certificates: 'certificate' becomes a
-- valid related entity for templates + scheduled messages, and
-- 'certificate_issuer' a valid recipient resolver (the contractor from
-- maintenance_suppliers linked via certificates.contractor_id).

alter table public.message_templates
  drop constraint if exists message_templates_entity_type_check;
alter table public.message_templates
  add constraint message_templates_entity_type_check check (entity_type in
    ('property', 'unit', 'tenancy', 'pm_tenant', 'works_order', 'owner',
     'certificate', 'none'));

alter table public.scheduled_messages
  drop constraint if exists scheduled_messages_related_entity_type_check;
alter table public.scheduled_messages
  add constraint scheduled_messages_related_entity_type_check
  check (related_entity_type in
    ('property', 'unit', 'tenancy', 'pm_tenant', 'works_order', 'owner',
     'certificate'));

alter table public.scheduled_messages
  drop constraint if exists scheduled_messages_recipient_resolver_check;
alter table public.scheduled_messages
  add constraint scheduled_messages_recipient_resolver_check
  check (recipient_resolver in
    ('tenancy_renter', 'property_owner', 'works_order_contractor',
     'certificate_issuer'));
