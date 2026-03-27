-- Phase 2 Seed Data
-- Inserts realistic mock data for pm_tenants, guarantors, property_contracts,
-- booking_forms, form_questions, bookings, and form_responses.
-- Uses dynamic lookup of existing tenant/unit/property IDs from Phase 1 seed.

do $$
declare
  v_tenant_id        uuid;
  v_portfolio_id     uuid;
  v_unit_ids         uuid[];
  v_property_ids     uuid[];

  -- pm_tenant ids
  v_t1 uuid := gen_random_uuid();
  v_t2 uuid := gen_random_uuid();
  v_t3 uuid := gen_random_uuid();
  v_t4 uuid := gen_random_uuid();
  v_t5 uuid := gen_random_uuid();
  v_t6 uuid := gen_random_uuid();

  -- contract ids
  v_c1 uuid := gen_random_uuid();
  v_c2 uuid := gen_random_uuid();
  v_c3 uuid := gen_random_uuid();

  -- booking form id
  v_form_id uuid := gen_random_uuid();

  -- booking ids
  v_b1 uuid := gen_random_uuid();
  v_b2 uuid := gen_random_uuid();
  v_b3 uuid := gen_random_uuid();
  v_b4 uuid := gen_random_uuid();

  -- question ids
  v_q1 uuid := gen_random_uuid();
  v_q2 uuid := gen_random_uuid();
  v_q3 uuid := gen_random_uuid();
  v_q4 uuid := gen_random_uuid();
  v_q5 uuid := gen_random_uuid();
  v_q6 uuid := gen_random_uuid();
  v_q7 uuid := gen_random_uuid();
  v_q8 uuid := gen_random_uuid();
  v_q9 uuid := gen_random_uuid();
begin
  -- Get existing tenant
  select id into v_tenant_id from public.tenants limit 1;
  if v_tenant_id is null then
    raise notice 'No tenant found — skipping Phase 2 seed';
    return;
  end if;

  -- Get existing portfolio
  select id into v_portfolio_id from public.portfolios where tenant_id = v_tenant_id limit 1;

  -- Get unit IDs (available units for contracts/bookings)
  select array_agg(id order by created_at) into v_unit_ids
  from public.units where tenant_id = v_tenant_id limit 6;

  -- Get property IDs
  select array_agg(id order by created_at) into v_property_ids
  from public.properties where tenant_id = v_tenant_id limit 3;

  -- ============================================================
  -- PM Tenants (6 diverse residents)
  -- ============================================================
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality,
    current_address, employment_status, employer_name, job_title,
    right_to_rent_type, right_to_rent_verified, notes, created_at, updated_at)
  values
    (v_t1, v_tenant_id, 'James Whitfield', 'james.whitfield@gmail.com', '07712 345678',
      '1991-04-15', 'British', '12 Clerkenwell Road, London EC1R 5DL',
      'professional', 'Goldman Sachs', 'Financial Analyst',
      'british_passport', true, 'Finance professional. Clean references. No pets.', now() - interval '6 months', now()),

    (v_t2, v_tenant_id, 'Aleksandra Kowalski', 'akowalski@outlook.com', '07823 456789',
      '1995-09-22', 'Polish', '34 Commercial Street, London E1 6LT',
      'professional', 'Tech Solutions Ltd', 'Software Engineer',
      'eu_settled', true, 'EU Settled status confirmed. Works in tech. Excellent tenant.', now() - interval '8 months', now()),

    (v_t3, v_tenant_id, 'Priya Sharma', 'priya.sharma@hotmail.com', '07934 567890',
      '1998-11-03', 'Indian', '5 Whitechapel High St, London E1 7PL',
      'student', 'University College London', 'MSc Computer Science',
      'visa', false, 'Student visa expires March 2027. Guarantor provided.', now() - interval '2 months', now()),

    (v_t4, v_tenant_id, 'Oleksandr Koval', 'o.koval@gmail.com', '07845 678901',
      '1988-06-17', 'Ukrainian', '78 Bethnal Green Road, London E2 6DG',
      'professional', 'London Hospitality Group', 'Head Chef',
      'visa', true, 'Skilled worker visa. Highly recommended by previous landlord.', now() - interval '12 months', now()),

    (v_t5, v_tenant_id, 'Sophie Laurent', 'sophie.laurent@yahoo.fr', '07756 789012',
      '1993-02-28', 'French', '9 Borough Market Lane, London SE1 9AH',
      'self_employed', null, 'Freelance Graphic Designer',
      'eu_settled', true, 'Self-employed, provides 3 months bank statements. No guarantor needed.', now() - interval '4 months', now()),

    (v_t6, v_tenant_id, 'Mohammed Al-Rashid', 'mo.rashid@gmail.com', '07667 890123',
      '1996-07-11', 'British', '22 Shoreditch High Street, London E1 6JJ',
      'professional', 'KPMG', 'Associate Consultant',
      'british_passport', true, 'Graduate scheme at KPMG. Excellent credit score.', now() - interval '3 months', now());

  -- ============================================================
  -- Guarantors (for student tenant and visa tenant)
  -- ============================================================
  insert into public.guarantors (tenant_id, pm_tenant_id, full_name, phone, email, relationship, created_at)
  values
    (v_tenant_id, v_t3, 'Rajesh Sharma', '07700 111222', 'rajesh.sharma@gmail.com', 'Father', now() - interval '2 months'),
    (v_tenant_id, v_t4, 'Natalia Koval', '07700 333444', 'natalia.koval@gmail.com', 'Spouse', now() - interval '12 months');

  -- ============================================================
  -- Update units to link pm_tenants (first 4 units)
  -- ============================================================
  if array_length(v_unit_ids, 1) >= 1 then
    update public.units set pm_tenant_id = v_t1, status = 'occupied', notice_given = false
    where id = v_unit_ids[1];
  end if;
  if array_length(v_unit_ids, 1) >= 2 then
    update public.units set pm_tenant_id = v_t2, status = 'occupied', notice_given = false
    where id = v_unit_ids[2];
  end if;
  if array_length(v_unit_ids, 1) >= 3 then
    update public.units set pm_tenant_id = v_t4, status = 'move_out', notice_given = true, available_date = current_date + interval '45 days'
    where id = v_unit_ids[3];
  end if;

  -- ============================================================
  -- Property Contracts
  -- ============================================================
  if array_length(v_unit_ids, 1) >= 1 then
    insert into public.property_contracts (id, tenant_id, unit_id, pm_tenant_id, start_date,
      rent_pcm, deposit, collection_date, deposit_scheme, deposit_scheme_ref,
      deposit_protected_date, deposit_protection_deadline, status, signing_method, created_at, updated_at)
    values
      -- Active contract, deposit protected
      (v_c1, v_tenant_id, v_unit_ids[1], v_t1,
        current_date - interval '6 months',
        1850, 1850, 1, 'dps', 'DPS-2025-JW-441892',
        current_date - interval '6 months' + interval '14 days',
        current_date - interval '6 months' + interval '30 days',
        'active', 'email',
        now() - interval '6 months', now());
  end if;

  if array_length(v_unit_ids, 1) >= 2 then
    insert into public.property_contracts (id, tenant_id, unit_id, pm_tenant_id, start_date,
      rent_pcm, deposit, collection_date, deposit_scheme,
      deposit_protected_date, deposit_protection_deadline, deposit_protection_alert, status, signing_method, created_at, updated_at)
    values
      -- Active contract, deposit protected
      (v_c2, v_tenant_id, v_unit_ids[2], v_t2,
        current_date - interval '8 months',
        2100, 2100, 15, 'mydeposits',
        current_date - interval '8 months' + interval '21 days',
        current_date - interval '8 months' + interval '30 days',
        false, 'active', 'whatsapp',
        now() - interval '8 months', now());
  end if;

  if array_length(v_unit_ids, 1) >= 3 then
    insert into public.property_contracts (id, tenant_id, unit_id, pm_tenant_id, start_date,
      rent_pcm, deposit, collection_date, deposit_scheme, deposit_protection_deadline,
      status, notice_given_by, notice_given_date, vacate_date, signing_method, created_at, updated_at)
    values
      -- Notice given contract
      (v_c3, v_tenant_id, v_unit_ids[3], v_t4,
        current_date - interval '12 months',
        1600, 1600, 1, 'tds',
        current_date - interval '12 months' + interval '30 days',
        'notice_given', 'tenant',
        current_date - interval '15 days',
        current_date + interval '45 days',
        'paper',
        now() - interval '12 months', now());
  end if;

  -- ============================================================
  -- Booking Form
  -- ============================================================
  insert into public.booking_forms (id, tenant_id, portfolio_id, name, description, is_active, public_slug, created_at)
  values
    (v_form_id, v_tenant_id, v_portfolio_id,
      'Standard Application Form',
      'Our standard rental application form. Please complete all sections accurately.',
      true, 'apply-standard-' || left(replace(v_tenant_id::text, '-', ''), 8),
      now());

  -- ============================================================
  -- Form Questions
  -- ============================================================
  insert into public.form_questions (id, tenant_id, form_id, question_text, question_type, is_required, sort_order, created_at)
  values
    (v_q1, v_tenant_id, v_form_id, 'Full legal name (as it appears on your ID)', 'text', true, 1, now()),
    (v_q2, v_tenant_id, v_form_id, 'Date of birth', 'date', true, 2, now()),
    (v_q3, v_tenant_id, v_form_id, 'Current address', 'textarea', true, 3, now()),
    (v_q4, v_tenant_id, v_form_id, 'Employment status', 'select', true, 4, now()),
    (v_q5, v_tenant_id, v_form_id, 'Employer / University name', 'text', false, 5, now()),
    (v_q6, v_tenant_id, v_form_id, 'Monthly income (after tax, in £)', 'number', true, 6, now()),
    (v_q7, v_tenant_id, v_form_id, 'Right to rent document type', 'select', true, 7, now()),
    (v_q8, v_tenant_id, v_form_id, 'Will you require a guarantor?', 'select', false, 8, now()),
    (v_q9, v_tenant_id, v_form_id, 'Any additional information or special requirements?', 'textarea', false, 9, now());

  -- Set select options
  update public.form_questions set options = '["Employed full-time","Employed part-time","Self-employed","Student","Unemployed","Other"]'::jsonb where id = v_q4;
  update public.form_questions set options = '["British/Irish passport","EU Settled/Pre-Settled status","Share code","Visa","Other"]'::jsonb where id = v_q7;
  update public.form_questions set options = '["Yes","No"]'::jsonb where id = v_q8;

  -- ============================================================
  -- Bookings (mix of statuses)
  -- ============================================================
  if array_length(v_unit_ids, 1) >= 4 then
    insert into public.bookings (id, tenant_id, unit_id, property_id, portfolio_id, form_id,
      status, applicant_name, applicant_email, applicant_phone, submitted_at, notes, created_at)
    values
      (v_b1, v_tenant_id, v_unit_ids[4], v_property_ids[1], v_portfolio_id, v_form_id,
        'pending', 'Emma Thompson', 'emma.thompson@gmail.com', '07712 100001',
        now() - interval '2 days', null, now() - interval '2 days'),

      (v_b2, v_tenant_id, v_unit_ids[4], v_property_ids[1], v_portfolio_id, v_form_id,
        'under_review', 'Daniel Chen', 'daniel.chen@yahoo.com', '07812 200002',
        now() - interval '5 days', 'Highly recommended by current landlord', now() - interval '5 days');
  end if;

  if array_length(v_unit_ids, 1) >= 5 then
    insert into public.bookings (id, tenant_id, unit_id, property_id, portfolio_id, form_id,
      status, applicant_name, applicant_email, applicant_phone, submitted_at,
      reviewed_at, rejection_reason, notes, created_at)
    values
      (v_b3, v_tenant_id, v_unit_ids[5], v_property_ids[1], v_portfolio_id, v_form_id,
        'rejected', 'Kevin O''Brien', 'k.obrien@hotmail.com', '07912 300003',
        now() - interval '10 days',
        now() - interval '8 days', 'References could not be verified', null,
        now() - interval '10 days');
  end if;

  if array_length(v_unit_ids, 1) >= 6 then
    insert into public.bookings (id, tenant_id, unit_id, property_id, portfolio_id, form_id,
      status, applicant_name, applicant_email, applicant_phone, submitted_at,
      converted_pm_tenant_id, reviewed_at, notes, created_at)
    values
      (v_b4, v_tenant_id, v_unit_ids[6], v_property_ids[1], v_portfolio_id, v_form_id,
        'approved', 'Mohammed Al-Rashid', 'mo.rashid@gmail.com', '07667 890123',
        now() - interval '14 days',
        v_t6, now() - interval '12 days', null,
        now() - interval '14 days');
  end if;

  -- ============================================================
  -- Form Responses (for pending and under_review bookings)
  -- ============================================================
  if array_length(v_unit_ids, 1) >= 4 then
    insert into public.form_responses (tenant_id, booking_id, question_id, answer_text, created_at)
    values
      (v_tenant_id, v_b1, v_q1, 'Emma Louise Thompson', now() - interval '2 days'),
      (v_tenant_id, v_b1, v_q2, '1996-03-14', now() - interval '2 days'),
      (v_tenant_id, v_b1, v_q3, '47 Dalston Lane, London E8 3DF', now() - interval '2 days'),
      (v_tenant_id, v_b1, v_q4, 'Employed full-time', now() - interval '2 days'),
      (v_tenant_id, v_b1, v_q5, 'Barclays Bank', now() - interval '2 days'),
      (v_tenant_id, v_b1, v_q6, '3500', now() - interval '2 days'),
      (v_tenant_id, v_b1, v_q7, 'British/Irish passport', now() - interval '2 days'),
      (v_tenant_id, v_b1, v_q8, 'No', now() - interval '2 days'),

      (v_tenant_id, v_b2, v_q1, 'Daniel Wei Chen', now() - interval '5 days'),
      (v_tenant_id, v_b2, v_q2, '1994-11-08', now() - interval '5 days'),
      (v_tenant_id, v_b2, v_q3, '15 Liverpool Street, London EC2M 7PN', now() - interval '5 days'),
      (v_tenant_id, v_b2, v_q4, 'Employed full-time', now() - interval '5 days'),
      (v_tenant_id, v_b2, v_q5, 'Deloitte UK', now() - interval '5 days'),
      (v_tenant_id, v_b2, v_q6, '4800', now() - interval '5 days'),
      (v_tenant_id, v_b2, v_q7, 'British/Irish passport', now() - interval '5 days'),
      (v_tenant_id, v_b2, v_q8, 'No', now() - interval '5 days'),
      (v_tenant_id, v_b2, v_q9, 'I have a cat — happy to discuss', now() - interval '5 days');
  end if;

  raise notice 'Phase 2 seed complete for tenant %', v_tenant_id;
end $$;
