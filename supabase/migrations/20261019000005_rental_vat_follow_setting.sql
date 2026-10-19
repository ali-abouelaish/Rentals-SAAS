-- Rentals still awaiting approval follow the agency's current VAT setting.
--
-- 20261019000003 stamped rental_codes.vat_applies once, at creation. That
-- protects paid history, but it also froze rentals nobody has approved yet:
-- switching VAT off left every pending rental still having VAT deducted.
--
-- New rule: while a rental is pending / need_more_info, its vat_applies
-- tracks tenants.commission_vat_enabled. Approval freezes it — approved, paid
-- and refunded rentals never change when the switch is flipped.

create or replace function public.tenants_sync_pending_rental_vat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rental_codes
     set vat_applies = new.commission_vat_enabled
   where tenant_id = new.id
     and status in ('pending', 'need_more_info')
     and vat_applies is distinct from new.commission_vat_enabled;
  return new;
end;
$$;

drop trigger if exists tenants_sync_pending_rental_vat on public.tenants;
create trigger tenants_sync_pending_rental_vat
  after update of commission_vat_enabled on public.tenants
  for each row
  when (old.commission_vat_enabled is distinct from new.commission_vat_enabled)
  execute function public.tenants_sync_pending_rental_vat();

-- One-off: bring rentals already awaiting approval in line with each agency's
-- current setting (e.g. ones created before the switch was turned off).
update public.rental_codes rc
   set vat_applies = t.commission_vat_enabled
  from public.tenants t
 where t.id = rc.tenant_id
   and rc.status in ('pending', 'need_more_info')
   and rc.vat_applies is distinct from t.commission_vat_enabled;
