"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils/formatters";
import { approveRentalCode } from "@/features/rentals/actions/rentals";

type Props = {
  rentalId: string;
  rentalAmount: number;
  paymentMethod: "cash" | "transfer" | "card";
  commissionPercent: number;
  marketingFeeDefault: number;
  assistedAgentId: string;
  marketingAgentId?: string | null;
};

export function RentalApprovalPanel({
  rentalId,
  rentalAmount,
  paymentMethod,
  commissionPercent,
  marketingFeeDefault,
  assistedAgentId,
  marketingAgentId
}: Props) {
  const [overrideFee, setOverrideFee] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");

  const paymentFee = paymentMethod === "cash" ? 0 : paymentMethod === "transfer" ? 0.2 : 0.0175;
  const base = useMemo(() => rentalAmount * (1 - paymentFee), [rentalAmount, paymentFee]);
  const assistedGross = useMemo(() => base * (commissionPercent / 100), [base, commissionPercent]);
  const threshold = useMemo(() => base * 0.45, [base]);

  const hasMarketingAgent =
    Boolean(marketingAgentId) && marketingAgentId !== assistedAgentId;
  const needsOverride = hasMarketingAgent && marketingFeeDefault > threshold;

  const overrideValue = overrideFee ? Number(overrideFee) : null;
  const marketingFeeValue = useMemo(() => {
    if (!hasMarketingAgent) return 0;
    if (!needsOverride) return marketingFeeDefault;
    if (overrideValue !== null && !Number.isNaN(overrideValue)) {
      return overrideValue;
    }
    return marketingFeeDefault;
  }, [hasMarketingAgent, needsOverride, marketingFeeDefault, overrideValue]);

  const assistedNet = useMemo(() => assistedGross - marketingFeeValue, [assistedGross, marketingFeeValue]);
  const invalidOverride =
    needsOverride &&
    overrideValue !== null &&
    !Number.isNaN(overrideValue) &&
    overrideValue > marketingFeeDefault;

  const invalidNet = assistedNet < 0;
  const canApprove = !invalidOverride && !invalidNet;

  return (
    <form
      action={async (formData) => {
        await approveRentalCode(formData);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="rental_id" value={rentalId} />
      {overrideFee ? (
        <input type="hidden" name="marketing_fee_override_gbp" value={overrideFee} />
      ) : null}
      {overrideReason ? (
        <input type="hidden" name="marketing_fee_override_reason" value={overrideReason} />
      ) : null}

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
            <div className="mt-2 border-t border-border pt-2 flex items-center justify-between">
              <span className="font-medium text-foreground">Assisted net</span>
              <span className={`text-base font-bold ${invalidNet ? "text-error" : "text-navy"}`}>
                {formatGBP(assistedNet)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {hasMarketingAgent && (needsOverride || invalidNet) ? (
        <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <div className="flex items-center gap-2 text-sm text-navy">
            <AlertTriangle size={16} />
            <span>
              {needsOverride
                ? "Marketing fee exceeds 45% of base. Add a custom amount."
                : "Marketing fee is higher than the assisted agent's earnings. Enter a lower custom amount."}
            </span>
          </div>
          <Badge className="border-accent text-accent-dark">Override required</Badge>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground-secondary">
                Custom marketing fee (GBP)
              </label>
              <Input
                type="number"
                min={0}
                max={marketingFeeDefault}
                step="0.01"
                placeholder={`Max ${formatGBP(marketingFeeDefault)}`}
                value={overrideFee}
                onChange={(event) => setOverrideFee(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground-secondary">
                Override reason (optional)
              </label>
              <Input
                placeholder="Why is this fee different?"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
              />
            </div>
          </div>
          {invalidOverride ? (
            <p className="text-xs text-error">
              Override cannot exceed the default marketing fee.
            </p>
          ) : null}
        </div>
      ) : null}

      {invalidNet ? (
        <p className="text-sm text-error">
          Marketing fee exceeds agent earnings. Enter a lower custom amount.
        </p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={!canApprove}>
        Approve rental
      </Button>
    </form>
  );
}
