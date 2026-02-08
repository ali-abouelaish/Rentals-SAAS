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

      <div className="grid gap-3 md:grid-cols-2 text-sm text-gray-600">
        <div>
          <p className="text-xs uppercase text-gray-500">Rental amount</p>
          <p className="text-sm text-navy">{formatGBP(rentalAmount)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Payment fee</p>
          <p className="text-sm text-navy">{paymentFee * 100}%</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Base after fee</p>
          <p className="text-sm text-navy">{formatGBP(base)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Assisted gross</p>
          <p className="text-sm text-navy">{formatGBP(assistedGross)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Default marketing fee</p>
          <p className="text-sm text-navy">{formatGBP(marketingFeeDefault)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Assisted net</p>
          <p className={`text-sm ${invalidNet ? "text-red-600" : "text-navy"}`}>
            {formatGBP(assistedNet)}
          </p>
        </div>
      </div>

      {needsOverride ? (
        <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <div className="flex items-center gap-2 text-sm text-navy">
            <AlertTriangle size={16} />
            <span>Marketing fee exceeds 45% of base. Add a custom amount.</span>
          </div>
          <Badge className="border-accent text-accent-dark">Override required</Badge>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              min={0}
              max={marketingFeeDefault}
              step="0.01"
              placeholder={`Max ${formatGBP(marketingFeeDefault)}`}
              value={overrideFee}
              onChange={(event) => setOverrideFee(event.target.value)}
            />
            <Input
              placeholder="Reason (optional)"
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
            />
          </div>
          {invalidOverride ? (
            <p className="text-xs text-red-600">
              Override cannot exceed the default marketing fee.
            </p>
          ) : null}
        </div>
      ) : null}

      {invalidNet ? (
        <p className="text-sm text-red-600">
          Marketing fee exceeds agent earnings. Enter a lower custom amount.
        </p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={!canApprove}>
        Approve rental
      </Button>
    </form>
  );
}
