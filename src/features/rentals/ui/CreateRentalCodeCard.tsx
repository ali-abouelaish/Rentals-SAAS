"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RentalCodeForm } from "./RentalCodeForm";

export function CreateRentalCodeCard({
  clientId,
  agents
}: {
  clientId: string;
  agents: { id: string; name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand">Create rental code</p>
        <Button
          type="button"
          variant={isOpen ? "ghost" : "secondary"}
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? "Cancel" : "Create rental code"}
        </Button>
      </div>

      {isOpen && (
        <RentalCodeForm clientId={clientId} agents={agents} />
      )}
    </div>
  );
}
