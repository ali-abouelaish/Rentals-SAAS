-- Demo requests from the public website (/signup): people who want a walkthrough of Harbor Ops.
--
-- Until now the website's demo form only pretended to send, so requests reached nobody. They are
-- now saved here, emailed to the team (PLATFORM_SALES_EMAIL) and confirmed to the requester.
--
-- Platform data, not agency data: there is no tenant_id, and no agency can read it. The pattern of
-- platform_audit_log (20260913000002): RLS enabled with NO policies, so PostgREST returns nothing to
-- any signed-in user; every read and write goes through the service-role client, from the public
-- submit action and from the super-admin pages behind requireSuperAdmin().
--
-- Kept until a super admin deletes the row by hand on /admin/demo-requests.

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),

  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  -- Stored lower-cased, so "one confirmation per address" can match it exactly.
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  company text not null check (char_length(company) between 1 and 120),

  -- Rooms, as ASCII slugs; the labels live in src/features/demo-requests/domain/schemas.ts.
  portfolio_size text not null
    check (portfolio_size in ('under_10', '10_49', '50_99', '100_200', '200_plus')),
  goal text check (goal is null or char_length(goal) <= 1000),
  -- 'enterprise' when they came from the pricing card's "Request a quote".
  plan_interest text check (plan_interest is null or plan_interest in ('standard', 'enterprise')),

  status text not null default 'new'
    check (status in ('new', 'contacted', 'booked', 'closed', 'spam')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 4000),

  terms_accepted_at timestamptz not null,
  -- When the email to the team and the confirmation to the requester went out (null: not sent).
  team_notified_at timestamptz,
  confirmation_sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The admin list: everything, or one status, newest first.
create index if not exists idx_demo_requests_created
  on public.demo_requests (created_at desc);
create index if not exists idx_demo_requests_status_created
  on public.demo_requests (status, created_at desc);

-- "At most one confirmation email per address per day" looks requests up by address.
create index if not exists idx_demo_requests_email_confirmation
  on public.demo_requests (email, confirmation_sent_at desc);

drop trigger if exists trg_demo_requests_updated_at on public.demo_requests;
create trigger trg_demo_requests_updated_at
  before update on public.demo_requests
  for each row execute function public.set_updated_at();

comment on table public.demo_requests is
  'Demo requests from the public website. Platform data: no tenant_id, readable only through the service role (super-admin pages).';

-- ============================================================
-- Row Level Security
-- ============================================================
-- Enabled with NO policies, as for platform_audit_log: no agency user can read or write any row.
alter table public.demo_requests enable row level security;
