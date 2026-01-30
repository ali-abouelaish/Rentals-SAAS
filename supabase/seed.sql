-- Seed note:
-- Create auth users with these emails before running this seed:
-- admin@demo.local, agent1@demo.local, agent2@demo.local, marketing@demo.local

insert into tenants (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Demo Agency');

insert into user_profiles (id, tenant_id, role, display_name)
select v.id::uuid, v.tenant_id::uuid, v.role, v.display_name
from (
  values
    ((select id from auth.users where email = 'admin@demo.local'), '11111111-1111-1111-1111-111111111111'::uuid, 'admin', 'Admin User'),
    ((select id from auth.users where email = 'agent1@demo.local'), '11111111-1111-1111-1111-111111111111'::uuid, 'agent', 'Agent One'),
    ((select id from auth.users where email = 'agent2@demo.local'), '11111111-1111-1111-1111-111111111111'::uuid, 'agent', 'Agent Two'),
    ((select id from auth.users where email = 'marketing@demo.local'), '11111111-1111-1111-1111-111111111111'::uuid, 'marketing_only', 'Marketing Only')
) as v(id, tenant_id, role, display_name)
where v.id is not null;

insert into agent_profiles (user_id, tenant_id, commission_percent, marketing_fee, role_flags)
select v.user_id::uuid, v.tenant_id::uuid, v.commission_percent, v.marketing_fee, v.role_flags::jsonb
from (
  values
    ((select id from auth.users where email = 'admin@demo.local'), '11111111-1111-1111-1111-111111111111'::uuid, 25, 50, '{"is_agent": true, "is_marketing": true}'),
    ((select id from auth.users where email = 'agent1@demo.local'), '11111111-1111-1111-1111-111111111111'::uuid, 20, 40, '{"is_agent": true, "is_marketing": false}'),
    ((select id from auth.users where email = 'agent2@demo.local'), '11111111-1111-1111-1111-111111111111'::uuid, 15, 30, '{"is_agent": true, "is_marketing": true}'),
    ((select id from auth.users where email = 'marketing@demo.local'), '11111111-1111-1111-1111-111111111111'::uuid, 0, 25, '{"is_agent": false, "is_marketing": true}')
) as v(user_id, tenant_id, commission_percent, marketing_fee, role_flags)
where v.user_id is not null;

insert into landlords (id, tenant_id, name, contact, email)
values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111'::uuid, 'Landlord A', '07111 111111', 'a@landlord.com'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'::uuid, 'Landlord B', '07222 222222', 'b@landlord.com'),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111'::uuid, 'Landlord C', '07333 333333', 'c@landlord.com');

insert into clients (id, tenant_id, full_name, phone, status, assigned_agent_id)
values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111'::uuid, 'Client One', '07000 111111', 'pending', (select id from auth.users where email = 'agent1@demo.local')),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111'::uuid, 'Client Two', '07000 222222', 'on_hold', (select id from auth.users where email = 'agent1@demo.local')),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'::uuid, 'Client Three', '07000 333333', 'solved', (select id from auth.users where email = 'agent2@demo.local')),
  ('33333333-3333-3333-3333-333333333334', '11111111-1111-1111-1111-111111111111'::uuid, 'Client Four', '07000 444444', 'pending', (select id from auth.users where email = 'agent2@demo.local')),
  ('33333333-3333-3333-3333-333333333335', '11111111-1111-1111-1111-111111111111'::uuid, 'Client Five', '07000 555555', 'pending', (select id from auth.users where email = 'agent1@demo.local')),
  ('33333333-3333-3333-3333-333333333336', '11111111-1111-1111-1111-111111111111'::uuid, 'Client Six', '07000 666666', 'pending', (select id from auth.users where email = 'agent2@demo.local')),
  ('33333333-3333-3333-3333-333333333337', '11111111-1111-1111-1111-111111111111'::uuid, 'Client Seven', '07000 777777', 'pending', (select id from auth.users where email = 'agent1@demo.local')),
  ('33333333-3333-3333-3333-333333333338', '11111111-1111-1111-1111-111111111111'::uuid, 'Client Eight', '07000 888888', 'pending', (select id from auth.users where email = 'agent2@demo.local')),
  ('33333333-3333-3333-3333-333333333339', '11111111-1111-1111-1111-111111111111'::uuid, 'Client Nine', '07000 999999', 'pending', (select id from auth.users where email = 'agent1@demo.local')),
  ('33333333-3333-3333-3333-333333333340', '11111111-1111-1111-1111-111111111111'::uuid, 'Client Ten', '07000 101010', 'pending', (select id from auth.users where email = 'agent2@demo.local'));

insert into rental_codes (id, tenant_id, client_id, landlord_id, code, consultation_fee_amount, payment_method, property_address, licensor_name, assisted_by_agent_id, status, client_snapshot)
values
  ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', 'CC0001', 100, 'cash', '10 Market St', 'Landlord A', (select id from auth.users where email = 'agent1@demo.local'), 'approved', '{"full_name": "Client One", "phone": "07000 111111"}'),
  ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'CC0002', 120, 'transfer', '22 River Rd', 'Landlord B', (select id from auth.users where email = 'agent1@demo.local'), 'pending', '{"full_name": "Client Two", "phone": "07000 222222"}'),
  ('44444444-4444-4444-4444-444444444443', '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222223', 'CC0003', 200, 'card', '5 King Rd', 'Landlord C', (select id from auth.users where email = 'agent2@demo.local'), 'approved', '{"full_name": "Client Three", "phone": "07000 333333"}'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222221', 'CC0004', 150, 'cash', '19 Park Ave', 'Landlord A', (select id from auth.users where email = 'agent2@demo.local'), 'pending', '{"full_name": "Client Four", "phone": "07000 444444"}'),
  ('44444444-4444-4444-4444-444444444445', '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333335', '22222222-2222-2222-2222-222222222221', 'CC0005', 180, 'transfer', '44 Lake St', 'Landlord A', (select id from auth.users where email = 'agent1@demo.local'), 'pending', '{"full_name": "Client Five", "phone": "07000 555555"}');

insert into document_sets (id, tenant_id, rental_code_id, set_type)
values
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444441', 'sourcing_agreement'),
  ('55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444443', 'client_id');

insert into listings_scraped (tenant_id, landlord_id, source, listing_url, title, price, postcode, is_active)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222221', 'spareroom', 'https://example.com/1', 'Listing One', 1200, 'E1', true),
  ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222221', 'spareroom', 'https://example.com/2', 'Listing Two', 1350, 'E2', false),
  ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222', 'rightmove', 'https://example.com/3', 'Listing Three', 1500, 'E3', true);

insert into bonuses (id, tenant_id, landlord_id, amount_owed, agent_id, payout_mode, status)
values
  ('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222221', 300, (select id from auth.users where email = 'agent1@demo.local'), 'standard', 'pending'),
  ('66666666-6666-6666-6666-666666666662', '11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222223', 450, (select id from auth.users where email = 'agent2@demo.local'), 'full', 'pending');

update bonuses
set code = 'LB-001'
where id = '66666666-6666-6666-6666-666666666661';

update bonuses
set code = 'LB-002'
where id = '66666666-6666-6666-6666-666666666662';

-- Dummy ledger entries (approved rentals)
insert into ledger_entries (tenant_id, type, reference_type, reference_id, amount_gbp, agent_earning_gbp, agent_id)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'rental_net', 'rental_code', '44444444-4444-4444-4444-444444444441', 100, 0, null),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'agent_earning', 'rental_code', '44444444-4444-4444-4444-444444444441', 0, 45, (select id from auth.users where email = 'agent1@demo.local')),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'marketing_fee', 'rental_code', '44444444-4444-4444-4444-444444444441', 0, 25, (select id from auth.users where email = 'marketing@demo.local')),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'rental_net', 'rental_code', '44444444-4444-4444-4444-444444444443', 200, 0, null),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'agent_earning', 'rental_code', '44444444-4444-4444-4444-444444444443', 0, 90, (select id from auth.users where email = 'agent2@demo.local'));

insert into activity_log (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, (select id from auth.users where email = 'agent1@demo.local'), 'rental_created', 'rental', '44444444-4444-4444-4444-444444444441', '{"code": "CC0001"}'),
  ('11111111-1111-1111-1111-111111111111'::uuid, (select id from auth.users where email = 'admin@demo.local'), 'rental_approved', 'rental', '44444444-4444-4444-4444-444444444441', '{"code": "CC0001"}'),
  ('11111111-1111-1111-1111-111111111111'::uuid, (select id from auth.users where email = 'agent2@demo.local'), 'rental_created', 'rental', '44444444-4444-4444-4444-444444444443', '{"code": "CC0003"}'),
  ('11111111-1111-1111-1111-111111111111'::uuid, (select id from auth.users where email = 'admin@demo.local'), 'rental_approved', 'rental', '44444444-4444-4444-4444-444444444443', '{"code": "CC0003"}');
