-- Agent-originated bookings from public property-share links.
--
-- External partner agents browse a tenant's live inventory on a token-gated
-- /s/[token] share. For an available unit they can now send a booking form and
-- propose an offer price. That immediately creates a `pending` booking carrying:
--   - the offer price they proposed (offer_price_pcm),
--   - who they are (agent_name / agent_email — the share link is anonymous, so
--     the agent self-identifies),
--   - where it came from (source = 'share', share_id → the originating link).
--
-- No new RLS: these columns live on the existing `bookings` table. The public
-- send path uses the service-role admin client (bypasses RLS) and scopes every
-- write to the share's tenant + a unit verified to be inside the share's scope.

alter table public.bookings
  add column if not exists offer_price_pcm numeric(10,2),
  add column if not exists agent_name      text,
  add column if not exists agent_email     text,
  add column if not exists source          text not null default 'direct',
  add column if not exists share_id        uuid references public.property_shares(id) on delete set null,
  -- One-time token threaded into the applicant's /apply link so their submission
  -- binds back to this pre-created booking instead of inserting a duplicate.
  add column if not exists form_send_token uuid;

create unique index if not exists bookings_form_send_token_uniq
  on public.bookings (form_send_token) where form_send_token is not null;

-- Constrain provenance to known sources (existing rows default to 'direct').
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_source_check'
  ) then
    alter table public.bookings
      add constraint bookings_source_check check (source in ('direct', 'share'));
  end if;
end $$;

create index if not exists bookings_share_id_idx on public.bookings (share_id);
