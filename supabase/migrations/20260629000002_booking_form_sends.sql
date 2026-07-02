-- Track generic Forms sent against a booking so the booking reference can show
-- which forms were sent and (via a per-send token) which responses came back.
--
-- The public generic-form submit only knows the form slug (a shared link), so we
-- mint a unique token per send and thread it through the form URL; on submit we
-- match the token back to this row → its booking.

create table if not exists public.booking_form_sends (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  booking_id      uuid references public.bookings(id) on delete cascade,        -- nullable: forms can be sent without a booking
  form_id         uuid not null references public.forms(id) on delete cascade,
  recipient_email text not null,
  token           text not null unique,
  status          text not null default 'sent' check (status in ('sent','completed')),
  submission_id   uuid references public.form_submissions(id) on delete set null,
  sent_at         timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists booking_form_sends_booking_id_idx on public.booking_form_sends (booking_id);
create index if not exists booking_form_sends_token_idx on public.booking_form_sends (token);

-- RLS: admin-only access scoped to tenant; the public submit attributes via
-- createSupabaseAdminClient() (service role), which bypasses RLS.
alter table public.booking_form_sends enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'booking_form_sends' and policyname = 'booking_form_sends_admin_all'
  ) then
    create policy "booking_form_sends_admin_all" on public.booking_form_sends
      for all using (
        tenant_id = (select current_tenant_id())
        and is_admin()
      );
  end if;
end $$;
