import Link from "next/link";
import { Flame, Phone, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LeadStatusSelect } from "./LeadStatusSelect";
import { LeadAssignSelect } from "./LeadAssignSelect";
import { tidyMessageText } from "@/lib/gmail/tidyText";
import { WEBSITE_SOURCE, isPlaceholderEmail, leadSourceLabel } from "../domain/sources";
import type { LeadWithRelations } from "../domain/types";

interface Props {
  lead: LeadWithRelations;
  agents: { id: string; display_name: string | null }[];
  isAdmin: boolean;
  /** The connected website that delivered it, for website leads. */
  viaLabel?: string | null;
}

export function LeadDetailsCard({ lead, agents, isAdmin, viaLabel }: Props) {
  const hasEmail = !isPlaceholderEmail(lead.email);
  const fromWebsite = lead.source === WEBSITE_SOURCE;
  const sourceLabel = leadSourceLabel(lead.source);

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
            <p className="text-sm text-foreground-muted">{hasEmail ? lead.email : lead.telephone}</p>
          </div>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      {/* Contact */}
      <div className="grid gap-4 sm:grid-cols-2">
        {hasEmail && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Email</label>
            <p className="text-sm text-foreground">{lead.email}</p>
          </div>
        )}
        {lead.telephone && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted flex items-center gap-1">
              <Phone className="h-3 w-3" /> Phone
            </label>
            <a
              href={`tel:${lead.telephone_clean ?? lead.telephone.replace(/[^\d+]/g, "")}`}
              className="text-sm text-blue-600 hover:underline"
            >
              {lead.telephone}
            </a>
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
            <label className="block text-xs font-medium text-foreground-muted">
              {fromWebsite ? "Enquiry page" : "Listing link"}
            </label>
            <a
              href={lead.property_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              {fromWebsite ? "View page on website" : `View on ${sourceLabel}`}{" "}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground-muted">Source</label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block text-sm rounded-full bg-surface-inset border border-border px-2 py-0.5">
              {sourceLabel}
            </span>
            {viaLabel && <span className="text-xs text-foreground-muted">via {viaLabel}</span>}
          </div>
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
      {tidyMessageText(lead.message_text) && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground-muted">Message</label>
          <p className="text-sm text-foreground whitespace-pre-wrap rounded-lg bg-surface-inset border border-border p-3">
            {tidyMessageText(lead.message_text)}
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
                className="text-blue-600 hover:underline"
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
