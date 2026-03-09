"use client";

import { useMemo } from "react";
import { formatGBP } from "@/lib/utils/formatters";

type Props = {
  rentalAmount: number;
  paymentMethod: "cash" | "transfer" | "card";
  commissionPercent: number;
  marketingFeeDefault: number;
  assistedAgentId: string;
  marketingAgentId?: string | null;
};

export function RentalPayoutSummary({
  rentalAmount,
  paymentMethod,
  commissionPercent,
  marketingFeeDefault,
  assistedAgentId,
  marketingAgentId
}: Props) {
  const paymentFee = paymentMethod === "cash" ? 0 : paymentMethod === "transfer" ? 0.2 : 0.0175;
  const base = useMemo(() => rentalAmount * (1 - paymentFee), [rentalAmount, paymentFee]);
  const assistedGross = useMemo(() => base * (commissionPercent / 100), [base, commissionPercent]);
  const threshold = useMemo(() => base * 0.45, [base]);

  const hasMarketingAgent = Boolean(marketingAgentId) && marketingAgentId !== assistedAgentId;
  const needsOverride = hasMarketingAgent && marketingFeeDefault > threshold;
  const marketingFeeValue = useMemo(() => {
    if (!hasMarketingAgent) return 0;
    if (!needsOverride) return marketingFeeDefault;
    return marketingFeeDefault;
  }, [hasMarketingAgent, needsOverride, marketingFeeDefault]);

  const assistedNet = useMemo(
    () => assistedGross - marketingFeeValue,
    [assistedGross, marketingFeeValue]
  );
  const invalidNet = assistedNet < 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface-inset p-4">
        <p className="mb-3 text-sm font-semibold text-navy">Calculation</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground-secondary">Payment method</span>
            <span className="font-semibold text-navy capitalize">{paymentMethod}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground-secondary">Rental amount</span>
            <span className="font-semibold text-navy">{formatGBP(rentalAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground-secondary">Payment fee</span>
            <span className="font-semibold text-navy">{(paymentFee * 100).toFixed(2)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground-secondary">Base after fee</span>
            <span className="font-semibold text-navy">{formatGBP(base)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-inset p-4">
        <p className="mb-3 text-sm font-semibold text-navy">Payout summary</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground-secondary">Assisted gross</span>
            <span className="font-semibold text-navy">{formatGBP(assistedGross)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground-secondary">Default marketing fee</span>
            <span className="font-semibold text-navy">{formatGBP(marketingFeeDefault)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground-secondary">Applied marketing fee</span>
            <span className="font-semibold text-navy">{formatGBP(marketingFeeValue)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="font-medium text-foreground">Assisted net</span>
            <span
              className={`text-base font-bold ${invalidNet ? "text-error" : "text-navy"}`}
            >
              {formatGBP(assistedNet)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
