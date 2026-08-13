-- Remove the phantom 20% "processing fee" on transfer rentals.
--
-- Background: 20260317000001 introduced a per-method "payment processing cost"
-- with transfer => 0.2. A bank transfer has no 20% processing cost; that figure
-- was VAT applied as a fee. When 20260612000003 added the real VAT divisor
-- (÷ 1.2) to transfers "mirroring card rentals", the 0.2 was left in place, so
-- transfer rentals have had VAT deducted twice ever since.
--
-- Correct treatment, now consistent across all three methods:
--   cash     -> no fee, no VAT          (x 1.0)
--   transfer -> no fee, VAT ÷ 1.2       (x 0.8333)
--   card     -> 1.75% machine fee, ÷1.2 (x 0.81875)
-- Card keeps its fee because a card machine is a genuine cost; transfer and
-- cash are not.
--
-- Retroactive: the view recomputes from source data, so every historical
-- transfer rental re-reports at the corrected rate. Transfer nets rise 25%
-- relative to what this view currently returns. Agent payouts already settled
-- at the old rate are NOT adjusted by this migration — see the reconciliation
-- report for the per-agent amounts owed on rentals already marked paid.

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
  -- strip 20% VAT on card and transfer.
  round(
    rc.consultation_fee_amount
    * (1 - case rc.payment_method
        when 'card' then 0.0175::numeric
        else 0::numeric
      end)
    / case rc.payment_method
        when 'card'     then 1.2::numeric
        when 'transfer' then 1.2::numeric
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
      / case rc.payment_method
          when 'card'     then 1.2::numeric
          when 'transfer' then 1.2::numeric
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
