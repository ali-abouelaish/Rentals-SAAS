"use client";

import Link from "next/link";
import { FileText, Mail, Phone, ScrollText, UserRound } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import type { OwnerLandlord, Property } from "../domain/types";

/** Only the identity/contact bits of the owner are needed here. */
export type PropertyLandlord = Pick<OwnerLandlord, "id" | "name" | "email" | "phone">;

const SCHEDULE_LABEL: Record<NonNullable<Property["payment_schedule"]>, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  biannual: "Every 6 months",
  annual: "Annually",
};

/** Same 60-day renewal window the owner-record expiry alerts use. */
const RENEWAL_WINDOW_DAYS = 60;

const TONE_CLASS = {
  error: "bg-error-bg text-error-fg border-error-border",
  warning: "bg-warning-bg text-warning-fg border-warning-border",
  success: "bg-success-bg text-success-fg border-success-border",
} as const;

function expiryState(expiry: string | null) {
  if (!expiry) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (expiry < today) return { label: "Expired", tone: "error" as const };

  const daysLeft = Math.round(
    (new Date(`${expiry}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
      86_400_000
  );
  if (daysLeft <= RENEWAL_WINDOW_DAYS) {
    return {
      label: daysLeft === 0 ? "Expires today" : `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      tone: "warning" as const,
    };
  }
  return { label: "Active", tone: "success" as const };
}

function Row({ label, value, hint }: { label: string; value: string | null; hint: string }) {
  return (
    <div>
      <Tooltip content={hint}>
        <p className="w-fit cursor-help text-[10px] font-medium uppercase tracking-wider text-foreground-muted">
          {label}
        </p>
      </Tooltip>
      <p className="mt-0.5 text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

/**
 * The head-lease agreement with the property's owner landlord — who they are,
 * the terms recorded against this property, and the signed document.
 *
 * Read-only by design: everything here is edited on the property form, so the
 * card links there rather than duplicating the inputs.
 */
export function LandlordContractCard({
  property,
  landlord,
  ownerRecordEnabled,
}: {
  property: Property;
  landlord: PropertyLandlord | null;
  /** /owners is behind the owner_statements entitlement — don't link into a 404. */
  ownerRecordEnabled: boolean;
}) {
  const editHref = `/properties/${property.id}/edit`;
  const expiry = expiryState(property.contract_expiry_date);

  const hasTerms = Boolean(
    property.contract_start_date ||
      property.contract_expiry_date ||
      property.monthly_rent_owed != null ||
      property.payment_schedule ||
      property.contract_document_url
  );

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          <ScrollText className="h-3.5 w-3.5" />
          Landlord contract
        </p>
        <Tooltip content="Change the landlord, the contract terms, or upload a new signed agreement.">
          <Link href={editHref} className="text-xs text-brand hover:underline">
            Edit
          </Link>
        </Tooltip>
      </div>

      {/* Who the contract is with */}
      {landlord ? (
        <div className="space-y-1 rounded-xl border border-border bg-surface-inset px-3 py-2.5">
          {ownerRecordEnabled ? (
            <Tooltip content="Open the landlord's record — their standing deal, other properties and statements.">
              <Link
                href={`/owners/${landlord.id}`}
                className="flex items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-brand"
              >
                <UserRound className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                <span className="truncate">{landlord.name}</span>
              </Link>
            </Tooltip>
          ) : (
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserRound className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
              <span className="truncate">{landlord.name}</span>
            </p>
          )}
          {(landlord.email || landlord.phone) && (
            <div className="flex flex-col gap-0.5 pl-[1.375rem]">
              {landlord.email && (
                <a
                  href={`mailto:${landlord.email}`}
                  className="flex items-center gap-1.5 truncate text-xs text-foreground-secondary hover:text-brand"
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{landlord.email}</span>
                </a>
              )}
              {landlord.phone && (
                <a
                  href={`tel:${landlord.phone}`}
                  className="flex items-center gap-1.5 text-xs text-foreground-secondary hover:text-brand"
                >
                  <Phone className="h-3 w-3 shrink-0" />
                  {landlord.phone}
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-surface-inset px-3 py-2.5 text-xs text-foreground-muted">
          No landlord assigned.{" "}
          <Link href={editHref} className="text-brand hover:underline">
            Assign one
          </Link>{" "}
          so the contract sits with a named owner.
        </p>
      )}

      {/* Terms recorded against this property */}
      {hasTerms ? (
        <>
          {expiry && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                TONE_CLASS[expiry.tone]
              )}
            >
              {expiry.label}
            </span>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Row
              label="Start"
              hint="When your agreement with the landlord for this property began."
              value={property.contract_start_date ? formatDate(property.contract_start_date) : null}
            />
            <Row
              label="Expiry"
              hint="When it runs out. Renew or serve notice before this date."
              value={
                property.contract_expiry_date ? formatDate(property.contract_expiry_date) : null
              }
            />
            <Row
              label="Rent owed"
              hint="What you owe the landlord each month for this property — not what tenants pay you."
              value={
                property.monthly_rent_owed != null
                  ? `${formatGBP(Number(property.monthly_rent_owed))} pcm`
                  : null
              }
            />
            <Row
              label="Paid"
              hint="How often you remit to the landlord under this contract."
              value={property.payment_schedule ? SCHEDULE_LABEL[property.payment_schedule] : null}
            />
          </div>

          {property.contract_document_url ? (
            <Tooltip content="Opens the signed agreement uploaded for this property in a new tab.">
              <a
                href={property.contract_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-inset px-3 py-2 text-sm font-medium text-brand transition-colors hover:border-brand/40"
              >
                <FileText className="h-3.5 w-3.5" />
                View contract document
              </a>
            </Tooltip>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-3 py-2 text-center text-xs text-foreground-muted">
              No signed document.{" "}
              <Link href={editHref} className="text-brand hover:underline">
                Upload one
              </Link>
            </p>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface-inset px-3 py-4 text-center">
          <ScrollText className="mx-auto mb-1.5 h-5 w-5 text-foreground-muted opacity-40" />
          <p className="text-xs text-foreground-muted">No contract recorded for this property</p>
          <Link href={editHref} className="text-xs text-brand hover:underline">
            Add the contract →
          </Link>
        </div>
      )}
    </div>
  );
}
