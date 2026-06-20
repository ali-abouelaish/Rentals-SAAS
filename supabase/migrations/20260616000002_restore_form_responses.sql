-- The repair migration (20260614000001) dropped form_questions CASCADE,
-- which also dropped form_responses (it had a FK to form_questions.id).
-- This migration restores form_responses with the same structure.

create table if not exists public.form_responses (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  question_id     uuid not null references public.form_questions(id) on delete cascade,
  answer_text     text,
  answer_file_url text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_form_responses_booking_id on public.form_responses (booking_id);

alter table public.form_responses enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'form_responses' and policyname = 'form_responses select'
  ) then
    create policy "form_responses select" on public.form_responses
      for select using (tenant_id = current_tenant_id());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'form_responses' and policyname = 'form_responses insert'
  ) then
    create policy "form_responses insert" on public.form_responses
      for insert with check (tenant_id = current_tenant_id() and is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'form_responses' and policyname = 'form_responses update'
  ) then
    create policy "form_responses update" on public.form_responses
      for update
      using (tenant_id = current_tenant_id() and is_admin())
      with check (tenant_id = current_tenant_id() and is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'form_responses' and policyname = 'form_responses delete'
  ) then
    create policy "form_responses delete" on public.form_responses
      for delete using (tenant_id = current_tenant_id() and is_admin());
  end if;
end $$;
