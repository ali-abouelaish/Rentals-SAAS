"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
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
  const [showOverride, setShowOverride] = useState(false);

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
    if (overrideValue !== null && !Number.isNaN(overrideValue)) return overrideValue;
    return marketingFeeDefault;
  }, [hasMarketingAgent, marketingFeeDefault, overrideValue]);

  const assistedNet = useMemo(() => assistedGross - marketingFeeValue, [assistedGross, marketingFeeValue]);
  const invalidOverride =
    overrideValue !== null &&
    !Number.isNaN(overrideValue) &&
    overrideValue > marketingFeeDefault;
  const invalidNet = assistedNet < 0;
  const overrideActive = overrideValue !== null && !Number.isNaN(overrideValue) && overrideValue >= 0;
  const canApprove = !invalidOverride && !invalidNet && (!needsOverride || overrideActive);

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
              <span className={`font-semibold ${overrideActive ? "text-accent-dark" : "text-navy"}`}>
                {formatGBP(marketingFeeValue)}
                {overrideActive && <span className="ml-1 text-xs">(overridden)</span>}
              </span>
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

      {hasMarketingAgent && (
        <div className={`rounded-2xl border p-4 space-y-3 ${
          needsOverride || invalidNet
            ? "border-error/40 bg-error/5"
            : overrideActive
            ? "border-accent/40 bg-accent/10"
            : "border-border bg-surface-inset"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {(needsOverride || invalidNet) && <AlertTriangle size={16} className="text-error" />}
              <span className="font-medium text-navy">
                {needsOverride
                  ? "Override required — fee exceeds 45% of base"
                  : invalidNet
                  ? "Override required — fee exceeds agent earnings"
                  : "Override marketing fee"}
              </span>
              {overrideActive && (
                <Badge className="border-accent text-accent-dark">Override set</Badge>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowOverride((v) => !v)}
              className="flex items-center gap-1 text-xs text-brand hover:underline"
            >
              {showOverride ? <><ChevronUp size={14} /> Hide</> : <><ChevronDown size={14} /> {overrideActive ? "Edit" : "Set override"}</>}
            </button>
          </div>

          {showOverride && (
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
              {invalidOverride && (
                <p className="md:col-span-2 text-xs text-error">
                  Override cannot exceed the default marketing fee.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {invalidNet && !hasMarketingAgent && (
        <p className="text-sm text-error">
          Marketing fee exceeds agent earnings. Enter a lower custom amount.
        </p>
      )}

      <Button type="submit" variant="secondary" disabled={!canApprove}>
        Approve rental
      </Button>
    </form>
  );
}
