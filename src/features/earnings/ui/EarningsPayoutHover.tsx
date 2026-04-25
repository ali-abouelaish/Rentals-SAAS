"use client";

import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { formatGBP } from "@/lib/utils/formatters";
import type { EarningsTransaction } from "../domain/types";

type Props = {
  transaction: EarningsTransaction;
  children: React.ReactNode;
};

export function EarningsPayoutHover({ transaction, children }: Props) {
  const p = transaction.payout;
  if (!p) return <>{children}</>;

  const hasMarketing = p.total_marketing_fee > 0;
  const showVat = p.vat_rate > 0;
  const isMarketingRole = transaction.role === "marketing";

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="cursor-help underline decoration-dotted underline-offset-2 decoration-foreground-muted/60">
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-80">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="font-semibold text-foreground">Payout summary</span>
            <span className="text-xs text-foreground-muted font-mono">{transaction.code}</span>
          </div>

          <Row label="Rental amount" value={formatGBP(p.rental_amount)} />
          {p.payment_fee_rate > 0 && (
            <Row
              label={`Payment fee (${(p.payment_fee_rate * 100).toFixed(2)}%)`}
              value={`−${formatGBP(p.rental_amount * p.payment_fee_rate)}`}
            />
          )}
          {showVat && (
            <Row
              label="VAT (20%)"
              value={`−${formatGBP(p.rental_amount * (1 - p.payment_fee_rate) - p.base_after_fee_and_vat)}`}
            />
          )}
          <Row
            label="Base"
            value={formatGBP(p.base_after_fee_and_vat)}
            bold
          />

          <div className="pt-2 border-t border-border space-y-2">
            {/* Assisted gross/commission % belongs to the assisted agent — hide
             *  it when the viewer is a marketing agent on someone else's rental. */}
            {!isMarketingRole && (
              <Row
                label={`Assisted gross (${p.commission_percent}%)`}
                value={formatGBP(p.assisted_gross)}
              />
            )}
            {hasMarketing && (
              <>
                <Row
                  label={
                    p.marketing_agent_count > 1
                      ? `Marketing fee (total, ${p.marketing_agent_count} agents)`
                      : "Marketing fee"
                  }
                  value={isMarketingRole ? formatGBP(p.total_marketing_fee) : `−${formatGBP(p.total_marketing_fee)}`}
                />
                {p.marketing_agent_count > 1 && (
                  <Row
                    label="Per marketing agent"
                    value={formatGBP(p.split_marketing_fee)}
                    muted
                  />
                )}
              </>
            )}
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="font-medium text-foreground">
              {isMarketingRole
                ? "Marketing share"
                : transaction.role === "assisted"
                ? "Assisted net"
                : "Agent earning"}
            </span>
            <span className="font-bold text-navy">{formatGBP(transaction.amount)}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-xs text-foreground-muted" : "text-foreground-secondary"}>
        {label}
      </span>
      <span
        className={
          bold
            ? "font-semibold text-navy tabular-nums"
            : muted
            ? "text-xs text-foreground-muted tabular-nums"
            : "font-medium text-navy tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}
