"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateRentalCode } from "@/features/rentals/actions/rentals";

type AgentOption = {
  id: string;
  display_name: string | null;
};

type RentalEditPanelProps = {
  rentalId: string;
  clientId: string;
  consultationFeeAmount: number;
  paymentMethod: "cash" | "transfer" | "card";
  propertyAddress: string;
  licensorName: string;
  marketingAgentName: string;
  agents: AgentOption[];
};

export function RentalEditPanel({
  rentalId,
  clientId,
  consultationFeeAmount,
  paymentMethod,
  propertyAddress,
  licensorName,
  marketingAgentName,
  agents,
}: RentalEditPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand">Edit rental</p>
        <Button
          type="button"
          variant={isEditing ? "outline" : "secondary"}
          size="sm"
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {isEditing ? (
        <form
          action={async (formData) => {
            await updateRentalCode(formData);
            setIsEditing(false);
          }}
          className="grid gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="rental_id" value={rentalId} />
          <input type="hidden" name="client_id" value={clientId} />
          <Input
            name="consultation_fee_amount"
            type="number"
            step="0.01"
            defaultValue={String(consultationFeeAmount)}
          />
          <select
            name="payment_method"
            defaultValue={paymentMethod}
            className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm"
          >
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
            <option value="card">Card</option>
          </select>
          <Input
            name="property_address"
            defaultValue={propertyAddress}
            placeholder="Property address"
          />
          <Input
            name="licensor_name"
            defaultValue={licensorName}
            placeholder="Licensor name"
          />
          <div className="md:col-span-2">
            <label className="text-xs text-foreground-secondary">Marketing agent (optional)</label>
            <Input
              list="marketing-agent-edit-list"
              name="marketing_agent_name"
              defaultValue={marketingAgentName}
              placeholder="Search by name"
            />
            <datalist id="marketing-agent-edit-list">
              {agents.map((agent) => (
                <option key={agent.id} value={agent.display_name ?? "Agent"} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" variant="secondary">
              Save changes
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
