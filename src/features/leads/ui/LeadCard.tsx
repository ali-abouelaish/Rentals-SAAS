import Link from "next/link";
import { ArrowRight, Flame, Phone } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Lead } from "../domain/types";

interface Props {
  lead: Lead & { assigned_agent: { display_name: string | null } | null };
}

export function LeadCard({ lead }: Props) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className="group flex items-center justify-between px-6 py-4 hover:bg-surface-hover transition-colors"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold text-sm">
          {lead.name[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{lead.name}</span>
            {lead.is_hot && (
              <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" aria-label="Hot lead" />
            )}
            {lead.has_phone && (
              <Phone className="h-3.5 w-3.5 text-foreground-muted shrink-0" aria-label="Has phone" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-foreground-muted truncate">{lead.email}</span>
            <span className="text-foreground-muted">·</span>
            <span className="text-xs capitalize text-foreground-secondary shrink-0 rounded-full bg-surface-inset px-2 py-0.5 border border-border">
              {lead.source}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <StatusBadge status={lead.status} size="sm" />
        <ArrowRight
          className="h-4 w-4 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
    </Link>
  );
}
