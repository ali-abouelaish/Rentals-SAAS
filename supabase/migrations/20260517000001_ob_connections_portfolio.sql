-- Scope each open-banking connection to a portfolio so a sync only matches
-- against that portfolio's active contracts (not the whole tenant).
alter table public.ob_connections
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null;

create index if not exists ob_connections_portfolio_id_idx
  on public.ob_connections(portfolio_id);
