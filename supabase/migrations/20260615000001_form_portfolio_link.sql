-- Link forms to portfolios (nullable — a form can belong to one portfolio or be global)

alter table public.forms
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null;

create index if not exists forms_portfolio_id_idx on public.forms (portfolio_id);
