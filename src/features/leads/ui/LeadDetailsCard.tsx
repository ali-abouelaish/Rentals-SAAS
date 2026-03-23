import Link from "next/link";
import { Flame, Phone, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LeadStatusSelect } from "./LeadStatusSelect";
import { LeadAssignSelect } from "./LeadAssignSelect";
import type { Lead } from "../domain/types";

interface Props {
  lead: Lead & {
    assigned_agent: { id: string; display_name: string | null } | null;
    listing: { id: string; title: string | null; url: string | null } | null;
  };
  agents: { id: string; display_name: string | null }[];
  isAdmin: boolean;
}

export function LeadDetailsCard({ lead, agents, isAdmin }: Props) {
  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent font-bold text-lg">
            {lead.name[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{lead.name}</h2>
              {lead.is_hot && <Flame className="h-4 w-4 text-orange-500" />}
            </div>
            <p className="text-sm text-foreground-muted">{lead.email}</p>
          </div>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      {/* Contact */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground-muted">Email</label>
          <p className="text-sm text-foreground">{lead.email}</p>
        </div>
        {lead.telephone && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted flex items-center gap-1">
              <Phone className="h-3 w-3" /> Phone
            </label>
            <p className="text-sm text-foreground">{lead.telephone}</p>
          </div>
        )}
        {(lead.address || lead.full_address) && (
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-foreground-muted">Property address</label>
            <p className="text-sm text-foreground">{lead.full_address ?? lead.address}</p>
          </div>
        )}
        {lead.property_ref && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Property ref</label>
            <p className="text-sm text-foreground font-mono">{lead.property_ref}</p>
          </div>
        )}
        {lead.property_url && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Listing link</label>
            <a
              href={lead.property_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              View on {lead.source} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground-muted">Source</label>
          <span className="inline-block capitalize text-sm rounded-full bg-surface-inset border border-border px-2 py-0.5">
            {lead.source}
          </span>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground-muted">Received</label>
          <p className="text-sm text-foreground">
            {new Date(lead.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Message */}
      {lead.message_text && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground-muted">Message</label>
          <p className="text-sm text-foreground whitespace-pre-wrap rounded-lg bg-surface-inset border border-border p-3">
            {lead.message_text}
          </p>
        </div>
      )}

      {/* Matched listing */}
      {lead.listing && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground-muted">Matched listing</label>
          <div className="flex items-center gap-2">
            <p className="text-sm text-foreground">{lead.listing.title ?? "Untitled listing"}</p>
            {lead.listing.url && (
              <a
                href={lead.listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-border">
        <LeadStatusSelect leadId={lead.id} currentStatus={lead.status} />
        {isAdmin && (
          <LeadAssignSelect
            leadId={lead.id}
            currentAssignedTo={lead.assigned_to}
            agents={agents}
          />
        )}
      </div>
    </div>
  );
}
