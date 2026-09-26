"use client";

import { ArrowRight, Flame, Phone } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { LeadWithRelations } from "../domain/types";

interface Props {
  lead: LeadWithRelations;
  onOpen: () => void;
}

export function LeadCard({ lead, onOpen }: Props) {
  const unread = !lead.clicked_at;
  const propertyAddress = lead.full_address ?? lead.address;
  const receivedAt = new Date(lead.created_at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center justify-between px-6 py-4 text-left hover:bg-surface-hover transition-colors"
    >
      <div className="flex items-center gap-4 min-w-0">
        {unread && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-blue-500"
            aria-label="Unread lead"
          />
        )}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold text-sm">
          {lead.name[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-sm text-foreground truncate ${unread ? "font-semibold" : "font-medium"}`}
            >
              {lead.name}
            </span>
            {lead.is_hot && (
              <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" aria-label="Hot lead" />
            )}
            {lead.has_phone && (
              <Phone className="h-3.5 w-3.5 text-foreground-muted shrink-0" aria-label="Has phone" />
            )}
            {propertyAddress && (
              <>
                <span className="text-foreground-muted shrink-0">·</span>
                <span className="text-xs text-foreground-muted truncate">{propertyAddress}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {!lead.email.includes("@noreply.local") && (
              <>
                <span className="text-xs text-foreground-muted truncate">{lead.email}</span>
                <span className="text-foreground-muted">·</span>
              </>
            )}
            {lead.email.includes("@noreply.local") && lead.telephone && (
              <>
                <span className="text-xs text-foreground-muted truncate">{lead.telephone}</span>
                <span className="text-foreground-muted">·</span>
              </>
            )}
            <span className="text-xs capitalize text-foreground-secondary shrink-0 rounded-full bg-surface-inset px-2 py-0.5 border border-border">
              {lead.source}
            </span>
            {lead.property_ref && (
              <span
                className="text-xs text-blue-600 shrink-0 rounded-full bg-blue-50 px-2 py-0.5 border border-blue-200"
                title="Property reference from the enquiry email"
              >
                Ref: {lead.property_ref}
              </span>
            )}
            <span className="text-foreground-muted shrink-0">·</span>
            <span className="text-xs text-foreground-muted shrink-0 whitespace-nowrap" title="When this lead arrived">
              {receivedAt}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <StatusBadge status={lead.status} size="sm" />
        <ArrowRight
          className="h-4 w-4 text-foreground-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        />
      </div>
    </button>
  );
}
