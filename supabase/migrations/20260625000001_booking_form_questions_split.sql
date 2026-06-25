-- Decouple booking forms from the generic-forms question store.
--
-- Background: `form_questions` originally belonged to booking forms
-- (form_id -> booking_forms). The generic-forms repair migration
-- (20260614000001) dropped `form_questions` CASCADE and recreated it with
-- form_id -> forms. That silently broke booking forms:
--   * adding a booking-form question fails the FK (form_id is a booking_forms id),
--   * reading booking_forms -> form_questions has no PostgREST relationship,
--   * the contract generator that reads booking answers loses its join.
--
-- Fix: booking forms get their own questions table, `booking_form_questions`,
-- and the booking-side foreign keys (form_responses.question_id and
-- contract_template_fields.question_id) are repointed at it. Generic forms keep
-- using `form_questions` untouched.
--
-- This migration is idempotent across both possible live states:
--   A) repair already applied  -> form_questions holds only generic questions,
--      form_responses is empty; nothing to move, FKs repoint cleanly.
--   B) repair not yet applied   -> form_questions still holds booking questions;
--      they are moved here (ids preserved) so dependent FKs stay valid.

create table if not exists public.booking_form_questions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  form_id       uuid not null references public.booking_forms(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in (
    'text','textarea','email','phone','date',
    'select','checkbox','file_upload','number','info'
  )),
  options       jsonb,
  is_required   boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_booking_form_questions_form_id
  on public.booking_form_questions (form_id, sort_order asc);

drop trigger if exists set_booking_form_questions_updated_at on public.booking_form_questions;
create trigger set_booking_form_questions_updated_at
  before update on public.booking_form_questions
  for each row execute function public.set_updated_at();

-- ── Move any existing booking-form questions out of form_questions ────────────
-- IDs are preserved so the FKs repointed below stay valid. In state (A) this
-- WHERE matches nothing and is a no-op.
insert into public.booking_form_questions (
  id, tenant_id, form_id, question_text, question_type,
  options, is_required, sort_order, created_at
)
select
  q.id, q.tenant_id, q.form_id, q.question_text, q.question_type,
  q.options, q.is_required, q.sort_order, q.created_at
from public.form_questions q
where q.form_id in (select id from public.booking_forms)
on conflict (id) do nothing;

-- ── Repoint form_responses.question_id at booking_form_questions ──────────────
-- Drop the existing FK on question_id regardless of its generated name, then
-- re-add it against booking_form_questions. Clear any rows that can't be mapped
-- (they would be orphaned booking answers whose question no longer exists).
delete from public.form_responses r
where r.question_id is not null
  and not exists (
    select 1 from public.booking_form_questions bq where bq.id = r.question_id
  );

do $$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_attribute att
    on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where con.conrelid = 'public.form_responses'::regclass
    and con.contype = 'f'
    and att.attname = 'question_id';
  if cname is not null then
    execute format('alter table public.form_responses drop constraint %I', cname);
  end if;
end $$;

alter table public.form_responses
  add constraint form_responses_question_id_fkey
  foreign key (question_id) references public.booking_form_questions(id) on delete cascade;

-- ── Repoint contract_template_fields.question_id at booking_form_questions ────
update public.contract_template_fields f
set question_id = null
where f.question_id is not null
  and not exists (
    select 1 from public.booking_form_questions bq where bq.id = f.question_id
  );

do $$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_attribute att
    on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where con.conrelid = 'public.contract_template_fields'::regclass
    and con.contype = 'f'
    and att.attname = 'question_id';
  if cname is not null then
    execute format('alter table public.contract_template_fields drop constraint %I', cname);
  end if;
end $$;

alter table public.contract_template_fields
  add constraint contract_template_fields_question_id_fkey
  foreign key (question_id) references public.booking_form_questions(id) on delete set null;

-- ── Remove the migrated rows from form_questions ──────────────────────────────
-- Safe now: the booking-side FKs above no longer reference form_questions, so
-- this won't cascade into form_responses. No-op in state (A).
delete from public.form_questions
where form_id in (select id from public.booking_forms);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.booking_form_questions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'booking_form_questions'
      and policyname = 'booking_form_questions_admin_all'
  ) then
    create policy "booking_form_questions_admin_all" on public.booking_form_questions
      for all using (
        tenant_id = (select current_tenant_id())
        and is_admin()
      );
  end if;
end $$;
