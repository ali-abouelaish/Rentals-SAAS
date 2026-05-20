-- ============================================================
-- Rental Marketing Claims — schema, indexes, RLS, storage
-- ============================================================
-- Lets a marketing-capable agent "claim" a rental by attaching
-- proof screenshots. The claim is independent of payout: it's a
-- record that this agent says they did the marketing work for
-- this rental. Admins can approve or reject.
--
-- A notification is dispatched (via email_outbox in the app
-- layer) to: the assisted agent on the rental, any admin, and
-- any already-linked marketing agents on the rental.
-- ============================================================

-- ─── rental_marketing_claims ───────────────────────────────
create table if not exists public.rental_marketing_claims (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  rental_id    uuid not null references public.rental_codes(id) on delete cascade,
  agent_id     uuid not null references public.user_profiles(id),
  status       text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  note         text,
  reviewed_by  uuid references public.user_profiles(id),
  reviewed_at  timestamptz,
  reject_reason text,
  created_at   timestamptz not null default now(),
  unique (rental_id, agent_id)
);

create index if not exists rental_marketing_claims_tenant_idx
  on public.rental_marketing_claims(tenant_id, created_at desc);
create index if not exists rental_marketing_claims_rental_idx
  on public.rental_marketing_claims(rental_id);
create index if not exists rental_marketing_claims_agent_idx
  on public.rental_marketing_claims(agent_id);
create index if not exists rental_marketing_claims_open_idx
  on public.rental_marketing_claims(tenant_id, status)
  where status = 'pending';

-- ─── rental_marketing_claim_proofs ─────────────────────────
-- Screenshot attachments uploaded by the claimant. File lives
-- in the rental_docs bucket under
--   {tenant_id}/{rental_id}/marketing_claim/{claim_id}/{uuid}-{filename}
create table if not exists public.rental_marketing_claim_proofs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  claim_id    uuid not null references public.rental_marketing_claims(id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists rental_marketing_claim_proofs_claim_idx
  on public.rental_marketing_claim_proofs(claim_id);

-- ─── RLS ───────────────────────────────────────────────────
alter table public.rental_marketing_claims       enable row level security;
alter table public.rental_marketing_claim_proofs enable row level security;

-- rental_marketing_claims
drop policy if exists "rental_marketing_claims select" on public.rental_marketing_claims;
create policy "rental_marketing_claims select" on public.rental_marketing_claims
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "rental_marketing_claims insert" on public.rental_marketing_claims;
create policy "rental_marketing_claims insert" on public.rental_marketing_claims
  for insert with check (
    tenant_id = (select current_tenant_id())
    and agent_id = (select auth.uid())
  );

drop policy if exists "rental_marketing_claims update" on public.rental_marketing_claims;
create policy "rental_marketing_claims update" on public.rental_marketing_claims
  for update using (
    tenant_id = (select current_tenant_id())
    and (
      (select is_admin())
      or (agent_id = (select auth.uid()) and status = 'pending')
    )
  )
  with check (tenant_id = (select current_tenant_id()));

drop policy if exists "rental_marketing_claims delete" on public.rental_marketing_claims;
create policy "rental_marketing_claims delete" on public.rental_marketing_claims
  for delete using (
    tenant_id = (select current_tenant_id())
    and (
      (select is_admin())
      or (agent_id = (select auth.uid()) and status = 'pending')
    )
  );

-- rental_marketing_claim_proofs
drop policy if exists "rental_marketing_claim_proofs select" on public.rental_marketing_claim_proofs;
create policy "rental_marketing_claim_proofs select" on public.rental_marketing_claim_proofs
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "rental_marketing_claim_proofs insert" on public.rental_marketing_claim_proofs;
create policy "rental_marketing_claim_proofs insert" on public.rental_marketing_claim_proofs
  for insert with check (tenant_id = (select current_tenant_id()));

drop policy if exists "rental_marketing_claim_proofs delete" on public.rental_marketing_claim_proofs;
create policy "rental_marketing_claim_proofs delete" on public.rental_marketing_claim_proofs
  for delete using (
    tenant_id = (select current_tenant_id())
    and (
      (select is_admin())
      or exists (
        select 1 from public.rental_marketing_claims c
        where c.id = claim_id
          and c.agent_id = (select auth.uid())
          and c.status = 'pending'
      )
    )
  );
