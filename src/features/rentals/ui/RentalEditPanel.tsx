"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { updateRentalCode } from "@/features/rentals/actions/rentals";
import { formatGBP } from "@/lib/utils/formatters";
import { toast } from "sonner";

type AgentOption = {
  id: string;
  display_name: string | null;
};

type RentalEditPanelProps = {
  rentalId: string;
  clientId: string;
  consultationFeeAmount: number;
  paymentMethod: "cash" | "transfer" | "card";
  marketingAgentIds: string[];
  marketingFeeDefault: number;
  commissionPercent: number;
  agents: AgentOption[];
};

export function RentalEditPanel({
  rentalId,
  clientId,
  consultationFeeAmount,
  paymentMethod,
  marketingAgentIds: initialMarketingAgentIds,
  marketingFeeDefault,
  commissionPercent,
  agents,
}: RentalEditPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [marketingAgentIds, setMarketingAgentIds] = useState<string[]>(initialMarketingAgentIds);
  const [overrideFee, setOverrideFee] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState(paymentMethod);
  const [currentFeeAmount, setCurrentFeeAmount] = useState(String(consultationFeeAmount));

  const hasMarketing = marketingAgentIds.some(Boolean);

  const paymentFee = currentPaymentMethod === "cash" ? 0 : currentPaymentMethod === "transfer" ? 0.2 : 0.0175;
  const base = useMemo(
    () => Math.round(Number(currentFeeAmount) * (1 - paymentFee) * 100) / 100,
    [currentFeeAmount, paymentFee]
  );
  const gross = useMemo(() => Math.round(base * (commissionPercent / 100) * 100) / 100, [base, commissionPercent]);
  const overrideValue = overrideFee ? Number(overrideFee) : null;
  const overrideActive = overrideValue !== null && !Number.isNaN(overrideValue) && overrideValue >= 0;
  const appliedFee = overrideActive ? overrideValue! : marketingFeeDefault;
  const assistedNet = useMemo(() => Math.round((gross - (hasMarketing ? appliedFee : 0)) * 100) / 100, [gross, appliedFee, hasMarketing]);

  const handleSubmit = async (formData: FormData) => {
    marketingAgentIds.filter(Boolean).forEach((id) => {
      formData.append("marketing_agent_id_list", id);
    });
    if (overrideActive) {
      formData.append("marketing_fee_override_gbp", String(overrideValue));
      if (overrideReason) formData.append("marketing_fee_override_reason", overrideReason);
    }
    startTransition(async () => {
      const result = await updateRentalCode(formData);
      if (result.ok) {
        toast.success("Rental updated");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update rental");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand">Edit rental</p>
        <Button
          type="button"
          variant={isEditing ? "outline" : "secondary"}
          size="sm"
          onClick={() => {
            if (!isEditing) {
              setMarketingAgentIds(initialMarketingAgentIds);
              setOverrideFee("");
              setOverrideReason("");
            }
            setIsEditing((prev) => !prev);
          }}
        >
          {isEditing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {isEditing ? (
        <form
          action={handleSubmit}
          className="space-y-4"
        >
          <input type="hidden" name="rental_id" value={rentalId} />
          <input type="hidden" name="client_id" value={clientId} />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-foreground-secondary">Consultation fee</label>
              <Input
                name="consultation_fee_amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={String(consultationFeeAmount)}
                onChange={(e) => setCurrentFeeAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-foreground-secondary">Payment method</label>
              <select
                name="payment_method"
                defaultValue={paymentMethod}
                onChange={(e) => setCurrentPaymentMethod(e.target.value as "cash" | "transfer" | "card")}
                className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm"
              >
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs text-foreground-secondary block">Marketing agents (optional)</label>
              {marketingAgentIds.map((agentId, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={agentId}
                    onChange={(val: string) => {
                      const updated = [...marketingAgentIds];
                      updated[index] = val;
                      setMarketingAgentIds(updated);
                    }}
                    options={[
                      { label: "Select agent", value: "" },
                      ...agents
                        .filter((a) => a.id === agentId || !marketingAgentIds.includes(a.id))
                        .map((a) => ({ label: a.display_name ?? "Agent", value: a.id })),
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => setMarketingAgentIds(marketingAgentIds.filter((_, i) => i !== index))}
                    className="text-error hover:text-error/80"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {marketingAgentIds.length < 5 && (
                <button
                  type="button"
                  onClick={() => setMarketingAgentIds([...marketingAgentIds, ""])}
                  className="text-xs text-brand hover:underline"
                >
                  + Add marketing agent
                </button>
              )}
            </div>
          </div>

          {hasMarketing && (
            <div className="rounded-xl border border-border bg-surface-inset p-4 space-y-3">
              <p className="text-sm font-medium text-navy">Marketing fee override (optional)</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-foreground-secondary">Custom marketing fee (GBP)</label>
                  <Input
                    type="number"
                    min={0}
                    max={marketingFeeDefault}
                    step="0.01"
                    placeholder={`Default ${formatGBP(marketingFeeDefault)}`}
                    value={overrideFee}
                    onChange={(e) => setOverrideFee(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-foreground-secondary">Override reason (optional)</label>
                  <Input
                    placeholder="Why is this fee different?"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-surface-card border border-border p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Gross commission</span>
                  <span className="font-medium text-navy">{formatGBP(gross)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">
                    Marketing fee {overrideActive ? "(overridden)" : "(default)"}
                  </span>
                  <span className={`font-medium ${overrideActive ? "text-accent-dark" : "text-navy"}`}>
                    {formatGBP(appliedFee)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="font-medium text-foreground">Your net</span>
                  <span className={`font-bold ${assistedNet < 0 ? "text-error" : "text-navy"}`}>
                    {formatGBP(assistedNet)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
