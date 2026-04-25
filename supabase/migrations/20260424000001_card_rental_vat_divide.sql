-- Switch card-rental VAT from (× 0.8) to (÷ 1.2).
-- Treats the post-processing amount as VAT-inclusive and extracts the net.
-- Retroactive: the view recomputes from source data so all historical
-- card rentals re-report with the new VAT calculation.

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
  -- rental_net: consultation fee minus payment processing cost, then
  -- divided by 1.2 to strip VAT (card only), applied sequentially.
  round(
    rc.consultation_fee_amount
    * (1 - case rc.payment_method
        when 'cash'     then 0::numeric
        when 'transfer' then 0.2::numeric
        when 'card'     then 0.0175::numeric
        else 0::numeric
      end)
    / case rc.payment_method
        when 'card' then 1.2::numeric
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
          when 'cash'     then 0::numeric
          when 'transfer' then 0.2::numeric
          when 'card'     then 0.0175::numeric
          else 0::numeric
        end)
      / case rc.payment_method
          when 'card' then 1.2::numeric
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
