-- Generic forms feature: forms, questions, submissions, answers

create table public.forms (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  public_slug text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on public.forms (tenant_id, created_at desc);

create trigger set_forms_updated_at
  before update on public.forms
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

create table public.form_questions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  form_id       uuid not null references public.forms(id) on delete cascade,
  question_text text not null,
  question_type text not null check (
    question_type in ('text','textarea','email','phone','date','select','checkbox','number','info')
  ),
  options       jsonb,
  is_required   boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.form_questions (form_id, sort_order asc);

create trigger set_form_questions_updated_at
  before update on public.form_questions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

create table public.form_submissions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  form_id          uuid not null references public.forms(id) on delete cascade,
  respondent_name  text,
  respondent_email text,
  respondent_phone text,
  submitted_at     timestamptz not null default now()
);

create index on public.form_submissions (form_id, submitted_at desc);

-- ─────────────────────────────────────────────────────────────────────────────

create table public.form_answers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  submission_id uuid not null references public.form_submissions(id) on delete cascade,
  question_id   uuid not null references public.form_questions(id) on delete cascade,
  answer_text   text
);

create index on public.form_answers (submission_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: admin-only access; public read/write goes via createSupabaseAdminClient()

alter table public.forms enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_submissions enable row level security;
alter table public.form_answers enable row level security;

create policy "forms_admin_all" on public.forms
  for all using (
    tenant_id = (select current_tenant_id())
    and is_admin()
  );

create policy "form_questions_admin_all" on public.form_questions
  for all using (
    tenant_id = (select current_tenant_id())
    and is_admin()
  );

create policy "form_submissions_admin_all" on public.form_submissions
  for all using (
    tenant_id = (select current_tenant_id())
    and is_admin()
  );

create policy "form_answers_admin_all" on public.form_answers
  for all using (
    tenant_id = (select current_tenant_id())
    and is_admin()
  );
