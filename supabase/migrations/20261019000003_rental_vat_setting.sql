-- Agency-wide switch: deduct VAT from rentals before commission.
--
-- On (the default, and how every agency has worked so far): card and transfer
-- rentals have 20% VAT stripped (÷ 1.2) before agent and manager commission is
-- worked out. Off: commission is worked out on the fee after the card machine
-- fee only. Bonuses never have VAT taken off either way.
--
-- Each rental records the setting at the moment it is created
-- (rental_codes.vat_applies), so flipping the switch only affects new rentals
-- and never rewrites earnings that may already have been paid. Existing rows
-- default to true, which is exactly today's behaviour.

alter table public.tenants
  add column if not exists commission_vat_enabled boolean not null default true;

alter table public.rental_codes
  add column if not exists vat_applies boolean not null default true;

-- Stamp the tenant's current setting onto every new rental, whatever the
-- client sent. Running in the database covers every insert path (app, public
-- API, import CLI).
create or replace function public.rental_codes_stamp_vat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.vat_applies := coalesce(
    (select t.commission_vat_enabled from public.tenants t where t.id = new.tenant_id),
    true
  );
  return new;
end;
$$;

drop trigger if exists rental_codes_stamp_vat on public.rental_codes;
create trigger rental_codes_stamp_vat
  before insert on public.rental_codes
  for each row execute function public.rental_codes_stamp_vat();

-- Same view as 20260813000001_transfer_remove_phantom_fee.sql, except the
-- VAT divisor now only applies when the rental was created with VAT on.
create or replace view rental_earnings_view
  with (security_invoker = true)
as
select
  rc.id,
  rc.tenant_id,
  rc.assisted_by_agent_id,
  rc.marketing_agent_id,
  rc.date,
  rc.consultation_fee_amount,
  rc.payment_method,
  rc.status,
  coalesce(ap.commission_percent, 0) as commission_percent,
  -- rental_net: fee minus real processing cost (card only), then ÷ 1.2 to
  -- strip 20% VAT on card and transfer when the rental has VAT applied.
  round(
    rc.consultation_fee_amount
    * (1 - case rc.payment_method
        when 'card' then 0.0175::numeric
        else 0::numeric
      end)
    / case
        when rc.vat_applies and rc.payment_method in ('card', 'transfer') then 1.2::numeric
        else 1::numeric
      end
  , 2) as rental_net,
  coalesce(
    rc.marketing_fee_override_gbp,
    case
      when rc.marketing_agent_id is not null
        and rc.marketing_agent_id != rc.assisted_by_agent_id
      then coalesce(ap_mkt.marketing_fee, 0)
      else 0
    end
  ) as marketing_fee,
  round(
    round(
      rc.consultation_fee_amount
      * (1 - case rc.payment_method
          when 'card' then 0.0175::numeric
          else 0::numeric
        end)
      / case
          when rc.vat_applies and rc.payment_method in ('card', 'transfer') then 1.2::numeric
          else 1::numeric
        end
    , 2)
    * coalesce(ap.commission_percent, 0) / 100
    - coalesce(
        rc.marketing_fee_override_gbp,
        case
          when rc.marketing_agent_id is not null
            and rc.marketing_agent_id != rc.assisted_by_agent_id
          then coalesce(ap_mkt.marketing_fee, 0)
          else 0
        end
      )
  , 2) as agent_earning
from rental_codes rc
join agent_profiles ap on ap.user_id = rc.assisted_by_agent_id
left join agent_profiles ap_mkt on ap_mkt.user_id = rc.marketing_agent_id
where rc.status in ('approved', 'paid');
