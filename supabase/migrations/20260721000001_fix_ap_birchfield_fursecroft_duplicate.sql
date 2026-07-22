-- Fix duplicate AP properties: Birchfield House & 53 Fursecroft (tenant b5b00020)
--
-- Root cause:
--   • The June import pipeline (import/run.mjs, DEFAULT_TENANT_ID = b5b00020)
--     created "Birchfield House" and "53 Fursecroft" WITH photos but assigned
--     them RANDOM property UUIDs (6f062f08… / 13fd5469…) and left every room
--     needsTenant=true (no pm_tenant linked). Every other AP property reused the
--     deterministic bb100000-… UUIDs, so no clash occurred for those.
--   • The later tenant-import migration (20260720000001) did not know those two
--     rows already existed, so it INSERTed a second copy of each property at the
--     deterministic UUIDs (bb100000-…-0a / bb100000-…-09) to carry the tenants.
--   • Net effect in tenant b5b00020: two Birchfield + two Fursecroft — one copy
--     with the photos (no tenants), one copy with the tenants (no photos).
--
-- This migration MERGES each pair, keeping the photo-bearing pipeline property as
-- canonical (so all unit_photos are preserved untouched) and grafting the
-- migration's tenant links + latest rent-roll (status/price/available_date/
-- deposit) onto its existing rooms, matched by room_number. The tenant-only
-- duplicate property + its rooms are then removed, and the Birchfield keybox
-- code is re-pointed onto the keeper so it is not lost.
--
-- Notes:
--   • Room sets match exactly (Birchfield 1-4; Fursecroft M1/D2/D3/D4/D5/ENS6),
--     so every tenant is transferred. A safety re-parent step handles any room
--     that has no counterpart on the keeper (re-attached instead of deleted).
--   • pm_tenants rows are NOT deleted — units reference them, so re-pointing the
--     keeper's rooms preserves them; the redundant dupe rooms are deleted after.
--   • Only affects tenant b5b00020. Tenant 11111111 was never touched by the
--     pipeline, so its Birchfield/Fursecroft (aa100000-…) have no duplicate.
--   • Guarded + idempotent: only runs while BOTH copies exist; after the merge
--     the dupe is gone, so a re-run is a no-op. If the live keeper UUIDs differ
--     from those recorded at import time, the guards make this a safe no-op
--     rather than an error.
--   • Everard House is a different shape and handled at the end. Its duplicate
--     (e3e6f4c8…) is the "row-21 chimera": AP sheet row 21 was renamed to
--     "Everard House" but kept Broxbourne's Bow / E3 3LJ, so the pipeline
--     inserted a separate property with a single junk room "A" (no tenant) and
--     18 photos. The REAL Everard (cc100000-…-04, Horizon portfolio) already
--     had its 4 rooms + tenants, so here the roles are inverted vs Birchfield:
--     the photos are moved onto the real Everard and the chimera is deleted
--     (matching the importer's own "delete the chimera in the app" note).
--     unit_photos.unit_id and .property_id are both ON DELETE CASCADE, so every
--     photo is re-pointed (both keys) BEFORE any delete, to avoid losing them.

do $$
declare
  v_tenant     uuid := 'b5b00020-9b30-4288-8ab4-a1e6c900dc96';
  -- keepers = import-pipeline properties that hold the photos (rooms have no tenant yet)
  v_keep_birch uuid := '6f062f08-536f-401f-9010-e2b555d402ba';
  v_keep_furse uuid := '13fd5469-078f-476c-b6ad-15b88bb46332';
  -- dupes = 20260720000001 tenant-import properties (tenants, no photos)
  v_dupe_birch uuid := 'bb100000-0000-4000-8000-00000000000a';
  v_dupe_furse uuid := 'bb100000-0000-4000-8000-000000000009';
  -- Everard (inverted): real property has the tenants; chimera holds the photos
  v_real_everard    uuid := 'cc100000-0000-4000-8000-000000000004';
  v_chimera_everard uuid := 'e3e6f4c8-dad5-4a0d-a63e-60abd04a323d';
begin
  if not exists (select 1 from public.tenants where id = v_tenant) then
    return;
  end if;

  -- ─── Birchfield House ─────────────────────────────────────────
  if exists (select 1 from public.properties where id = v_keep_birch and tenant_id = v_tenant)
     and exists (select 1 from public.properties where id = v_dupe_birch and tenant_id = v_tenant) then

    -- 1. Graft the migration's tenant + latest rent-roll onto the photo property's rooms.
    update public.units k
       set pm_tenant_id    = d.pm_tenant_id,
           status          = d.status,
           notice_given    = d.notice_given,
           available_date  = d.available_date,
           min_price_pcm   = d.min_price_pcm,
           max_price_pcm   = d.max_price_pcm,
           deposit         = d.deposit,
           couples_allowed = d.couples_allowed,
           furnishings     = d.furnishings,
           updated_at      = now()
      from public.units d
     where k.property_id = v_keep_birch and k.tenant_id = v_tenant
       and d.property_id = v_dupe_birch and d.tenant_id = v_tenant
       and lower(k.room_number) = lower(d.room_number);

    -- 2. Safety: any dupe room with no counterpart on the keeper -> re-parent (do not lose it).
    update public.units d
       set property_id = v_keep_birch, updated_at = now()
     where d.property_id = v_dupe_birch and d.tenant_id = v_tenant
       and not exists (select 1 from public.units k
                        where k.property_id = v_keep_birch and k.tenant_id = v_tenant
                          and lower(k.room_number) = lower(d.room_number));

    -- 3. Preserve the keybox code by re-pointing it at the keeper.
    update public.keys set property_id = v_keep_birch
     where property_id = v_dupe_birch and tenant_id = v_tenant;

    -- 4. Delete the now-redundant matched dupe rooms, then the empty dupe property.
    delete from public.units where property_id = v_dupe_birch and tenant_id = v_tenant;
    delete from public.properties where id = v_dupe_birch and tenant_id = v_tenant;

    raise notice 'Merged duplicate Birchfield House into photo property % for tenant %', v_keep_birch, v_tenant;
  end if;

  -- ─── 53 Fursecroft ────────────────────────────────────────────
  if exists (select 1 from public.properties where id = v_keep_furse and tenant_id = v_tenant)
     and exists (select 1 from public.properties where id = v_dupe_furse and tenant_id = v_tenant) then

    -- 1. Graft the migration's tenant + latest rent-roll onto the photo property's rooms.
    update public.units k
       set pm_tenant_id    = d.pm_tenant_id,
           status          = d.status,
           notice_given    = d.notice_given,
           available_date  = d.available_date,
           min_price_pcm   = d.min_price_pcm,
           max_price_pcm   = d.max_price_pcm,
           deposit         = d.deposit,
           couples_allowed = d.couples_allowed,
           furnishings     = d.furnishings,
           updated_at      = now()
      from public.units d
     where k.property_id = v_keep_furse and k.tenant_id = v_tenant
       and d.property_id = v_dupe_furse and d.tenant_id = v_tenant
       and lower(k.room_number) = lower(d.room_number);

    -- 2. Safety: re-parent any dupe room with no counterpart on the keeper.
    update public.units d
       set property_id = v_keep_furse, updated_at = now()
     where d.property_id = v_dupe_furse and d.tenant_id = v_tenant
       and not exists (select 1 from public.units k
                        where k.property_id = v_keep_furse and k.tenant_id = v_tenant
                          and lower(k.room_number) = lower(d.room_number));

    -- 3. Preserve any keybox code by re-pointing it at the keeper.
    update public.keys set property_id = v_keep_furse
     where property_id = v_dupe_furse and tenant_id = v_tenant;

    -- 4. Delete the now-redundant matched dupe rooms, then the empty dupe property.
    delete from public.units where property_id = v_dupe_furse and tenant_id = v_tenant;
    delete from public.properties where id = v_dupe_furse and tenant_id = v_tenant;

    raise notice 'Merged duplicate 53 Fursecroft into photo property % for tenant %', v_keep_furse, v_tenant;
  end if;

  -- ─── Everard House (row-21 chimera) ───────────────────────────
  if exists (select 1 from public.properties where id = v_real_everard and tenant_id = v_tenant)
     and exists (select 1 from public.properties where id = v_chimera_everard and tenant_id = v_tenant) then

    -- 1. Move every photo off the chimera (by property OR its junk unit) onto the
    --    real Everard as communal, BEFORE any delete — both FKs cascade, so a
    --    photo left pointing at the chimera would be destroyed. Idempotent: if the
    --    remap pass already re-pointed them, this matches nothing.
    update public.unit_photos
       set property_id = v_real_everard, unit_id = null
     where tenant_id = v_tenant
       and (property_id = v_chimera_everard
            or unit_id in (select id from public.units
                            where property_id = v_chimera_everard and tenant_id = v_tenant));

    -- 2. Defensively re-point any keybox rows off the chimera.
    update public.keys set property_id = v_real_everard
     where property_id = v_chimera_everard and tenant_id = v_tenant;

    -- 3. Delete the chimera's junk room(s), then the chimera property itself.
    delete from public.units where property_id = v_chimera_everard and tenant_id = v_tenant;
    delete from public.properties where id = v_chimera_everard and tenant_id = v_tenant;

    raise notice 'Removed Everard row-21 chimera %, photos moved to real Everard % for tenant %', v_chimera_everard, v_real_everard, v_tenant;
  end if;
end $$;
