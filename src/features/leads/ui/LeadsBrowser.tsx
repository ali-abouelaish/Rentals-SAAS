"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { LeadCard } from "./LeadCard";
import { LeadDetailsCard } from "./LeadDetailsCard";
import { DeleteLeadButton } from "./DeleteLeadButton";
import { markLeadClicked } from "../actions/leads";
import type { LeadWithRelations } from "../domain/types";

interface Props {
  leads: LeadWithRelations[];
  agents: { id: string; display_name: string | null }[];
  isAdmin: boolean;
}

export function LeadsBrowser({ leads, agents, isAdmin }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Derive the selected lead from the current list so that, after a delete or
  // refresh removes it, the drawer closes automatically.
  const selected = selectedId ? leads.find((l) => l.id === selectedId) ?? null : null;

  const handleOpen = (lead: LeadWithRelations) => {
    setSelectedId(lead.id);
    // Mark read on first open, then refresh so the unread dot clears.
    if (!lead.clicked_at) {
      markLeadClicked(lead.id)
        .then(() => router.refresh())
        .catch(() => {});
    }
  };

  return (
    <>
      <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
        <div className="divide-y divide-border">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onOpen={() => handleOpen(lead)} />
          ))}
        </div>
      </div>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent side="right" className="p-0 sm:max-w-[640px]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>Lead details</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <LeadDetailsCard lead={selected} agents={agents} isAdmin={isAdmin} />
                {isAdmin && (
                  <div className="flex">
                    <DeleteLeadButton leadId={selected.id} leadName={selected.name} />
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
