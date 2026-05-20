-- ============================================================
-- Marketing Claims — let the rental's assisted agent review too
-- ============================================================
-- Previously only admins (or the claimant, while still pending)
-- could update/delete a claim. Open this up so the assisted
-- agent on the rental can also approve / reject.
-- ============================================================

drop policy if exists "rental_marketing_claims update" on public.rental_marketing_claims;
create policy "rental_marketing_claims update" on public.rental_marketing_claims
  for update using (
    tenant_id = (select current_tenant_id())
    and (
      (select is_admin())
      or (agent_id = (select auth.uid()) and status = 'pending')
      or exists (
        select 1 from public.rental_codes rc
        where rc.id = rental_id
          and rc.assisted_by_agent_id = (select auth.uid())
      )
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
      or exists (
        select 1 from public.rental_codes rc
        where rc.id = rental_id
          and rc.assisted_by_agent_id = (select auth.uid())
      )
    )
  );
