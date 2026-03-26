-- Fix infinite recursion: rental_codes select policy queries rental_marketing_agents,
-- whose select policy queries rental_codes back → circular reference.
--
-- Solution: remove the rental_codes back-reference from the junction table policy.
-- rental_codes already has its own RLS, so the app-level join is already gated.
-- Any tenant member can safely read who the marketing agents are for any rental.

drop policy if exists "rental_marketing_agents select" on rental_marketing_agents;

create policy "rental_marketing_agents select"
on rental_marketing_agents for select
using (tenant_id = current_tenant_id());
