-- ─────────────────────────────────────────────────────────────────────────────
-- Duplicate the "AP" booking form → "Horizon Dreams Booking Form"
-- ─────────────────────────────────────────────────────────────────────────────
-- One-off data operation for the AP Real Estate / Horizon Dreams onboarding.
-- Copies a booking_forms row + ALL of its booking_form_questions into a new form.
--
-- This is NOT a migration — it targets a single live tenant and must never run
-- on dev/CI (which have no AP form). Run it by hand in the Supabase SQL editor
-- against the AP Real Estate project, per repo convention (Claude writes SQL,
-- you apply it manually).
--
-- What it does / does NOT copy:
--   • copies: name (renamed), description, is_active, and every question
--     (text/type/options/required/sort order), with fresh ids + a fresh slug.
--   • does NOT copy bank_details_id — the copy points at the Horizon Dreams
--     portfolio, so it must use Horizon Dreams' own bank account, not AP's.
--     Set it afterwards in Settings → Booking Forms (or leave it to inherit the
--     portfolio default).
--
-- Idempotent: re-running is a no-op once the target form exists.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══ STEP 1 — DISCOVERY (run this first, on its own, to fill in the CONFIG) ════
-- Confirm the tenant id, the EXACT source form name (or slug), and the target
-- portfolio name. Un-comment and run just this block, then edit STEP 2.
--
-- select id, name, public_slug, is_active,
--        portfolio_id,
--        (select p.name from public.portfolios p where p.id = bf.portfolio_id) as portfolio
--   from public.booking_forms bf
--  where tenant_id = 'b5b00020-9b30-4288-8ab4-a1e6c900dc96'   -- AP Real Estate
--  order by name;
--
-- select id, name from public.portfolios
--  where tenant_id = 'b5b00020-9b30-4288-8ab4-a1e6c900dc96'
--  order by name;


-- ══ STEP 2 — DUPLICATE ════════════════════════════════════════════════════════
do $$
declare
  ------------------------------------------------------------------ CONFIG -----
  v_tenant_id         uuid    := 'b5b00020-9b30-4288-8ab4-a1e6c900dc96'; -- AP Real Estate
  v_source_form_slug  text    := null;                    -- exact public_slug (unique) — preferred; leave null to match by name
  v_source_form_name  text    := 'AP';                    -- << EXACT source form name (used only when slug is null)
  v_target_form_name  text    := 'Horizon Dreams Booking Form';
  v_target_portfolio  text    := 'Horizon Dreams';        -- portfolio the copy attaches to; null = keep source's portfolio
  v_activate          boolean := true;                    -- create the copy active straight away?
  -------------------------------------------------------------------------------
  v_src           public.booking_forms%rowtype;
  v_match_count   int;
  v_portfolio_id  uuid;
  v_new_form_id   uuid := gen_random_uuid();
  v_new_slug      text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12); -- mirrors app slug (12 hex chars)
  v_q_count       int;
begin
  -- 1. Locate the source form — must resolve to exactly one row in this tenant.
  if v_source_form_slug is not null then
    select count(*) into v_match_count
      from public.booking_forms
     where tenant_id = v_tenant_id and public_slug = v_source_form_slug;
  else
    select count(*) into v_match_count
      from public.booking_forms
     where tenant_id = v_tenant_id and name = v_source_form_name;
  end if;

  if v_match_count = 0 then
    raise exception
      'Source form not found (slug=%, name=%) in tenant %. Run STEP 1 discovery and fix the CONFIG.',
      v_source_form_slug, v_source_form_name, v_tenant_id;
  elsif v_match_count > 1 then
    raise exception
      'Source form name "%" is ambiguous (% matches). Set v_source_form_slug to the exact public_slug instead.',
      v_source_form_name, v_match_count;
  end if;

  if v_source_form_slug is not null then
    select * into v_src from public.booking_forms
     where tenant_id = v_tenant_id and public_slug = v_source_form_slug;
  else
    select * into v_src from public.booking_forms
     where tenant_id = v_tenant_id and name = v_source_form_name;
  end if;

  -- 2. Resolve the target portfolio (fall back to the source form's portfolio).
  if v_target_portfolio is null then
    v_portfolio_id := v_src.portfolio_id;
  else
    select id into v_portfolio_id
      from public.portfolios
     where tenant_id = v_tenant_id and name = v_target_portfolio;
    if not found then
      raise exception 'Portfolio "%" not found in tenant %. Run STEP 1 discovery.', v_target_portfolio, v_tenant_id;
    end if;
  end if;

  -- 3. Idempotency guard — bail if the target already exists.
  if exists (
    select 1 from public.booking_forms
     where tenant_id = v_tenant_id and name = v_target_form_name
  ) then
    raise notice 'Target form "%" already exists in tenant % — nothing to do.', v_target_form_name, v_tenant_id;
    return;
  end if;

  -- 4. Insert the duplicated form (fresh id + slug; bank_details_id intentionally null).
  insert into public.booking_forms (
    id, tenant_id, portfolio_id, name, description, is_active, public_slug, bank_details_id
  )
  values (
    v_new_form_id, v_tenant_id, v_portfolio_id, v_target_form_name,
    v_src.description, v_activate, v_new_slug, null
  );

  -- 5. Copy every question verbatim (fresh ids, repointed form_id).
  insert into public.booking_form_questions (
    id, tenant_id, form_id, question_text, question_type, options, is_required, sort_order
  )
  select
    gen_random_uuid(), v_tenant_id, v_new_form_id,
    q.question_text, q.question_type, q.options, q.is_required, q.sort_order
  from public.booking_form_questions q
  where q.form_id = v_src.id;

  get diagnostics v_q_count = row_count;

  raise notice 'Duplicated form % ("%") → % ("%"): slug=%, % questions copied, portfolio=%.',
    v_src.id, v_src.name, v_new_form_id, v_target_form_name, v_new_slug, v_q_count, v_portfolio_id;
end $$;
