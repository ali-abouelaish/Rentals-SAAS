"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Clock, MailCheck, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import {
  formatIntegrationPrice,
  type Integration,
} from "@/lib/integrations/catalog";
import type { IntegrationSubscription } from "@/lib/integrations/subscriptions";
import { IntegrationLogo } from "./IntegrationLogo";

export type CardState =
  | "not_subscribed"
  | "active"
  | "pending_setup"
  | "ending"
  | "coming_soon";

/**
 * Which of the five states a card is in.
 *
 * Split out and exported so the state is decided once, from the subscription
 * row, rather than re-derived by each piece of the card and drifting apart.
 */
export function cardState(
  integration: Integration,
  subscription: IntegrationSubscription | undefined
): CardState {
  if (integration.availability === "coming_soon") return "coming_soon";
  if (!subscription) return "not_subscribed";
  if (subscription.status === "cancelled") {
    // A cancelled subscription that has already lapsed is indistinguishable
    // from never having had it — offer it again rather than showing a dead
    // "ended last March" card forever.
    const today = new Date().toISOString().slice(0, 10);
    return subscription.ends_on && subscription.ends_on >= today
      ? "ending"
      : "not_subscribed";
  }
  return subscription.status === "pending_setup" ? "pending_setup" : "active";
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const STATUS_BADGE: Record<CardState, { label: string; className: string } | null> = {
  not_subscribed: null,
  coming_soon: { label: "Coming soon", className: "bg-neutral-200 text-neutral-700" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
  pending_setup: { label: "Setup needed", className: "bg-amber-100 text-amber-800" },
  ending: { label: "Ending", className: "bg-neutral-200 text-neutral-700" },
};

export function IntegrationCard({
  integration,
  subscription,
  onActivate,
  onCancel,
}: {
  integration: Integration;
  subscription: IntegrationSubscription | undefined;
  onActivate: () => void;
  onCancel: () => void;
}) {
  const state = cardState(integration, subscription);
  const badge = STATUS_BADGE[state];
  const isOn = state === "active" || state === "pending_setup" || state === "ending";
  const isFree = integration.monthlyPricePence <= 0;

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IntegrationLogo integration={integration} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-foreground-muted">
              {integration.provider}
            </p>
            <h3 className="text-sm font-semibold text-foreground">{integration.name}</h3>
          </div>
        </div>
        {badge && (
          <span
            className={cn(
              "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              badge.className
            )}
          >
            {badge.label}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-foreground-secondary">
        {integration.summary}
      </p>

      <ul className="mt-3 space-y-1.5">
        {integration.benefits.map((benefit) => (
          <li key={benefit} className="flex gap-2 text-[11px] text-foreground-secondary">
            <Check className="h-3 w-3 shrink-0 mt-0.5 text-emerald-600" aria-hidden />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 pt-3 border-t border-border flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {formatIntegrationPrice(integration.monthlyPricePence)}
          </p>
          <p className="text-[11px] text-foreground-muted mt-0.5">
            {state === "ending" ? (
              <>Available until {formatDate(subscription?.ends_on ?? null)}</>
            ) : subscription?.is_grandfathered ? (
              "Included at no charge on your account"
            ) : state === "active" || state === "pending_setup" ? (
              subscription?.billing_starts_on ? (
                <>On your invoice from {formatDate(subscription.billing_starts_on)}</>
              ) : (
                "No charge"
              )
            ) : isFree ? (
              "Included in your plan"
            ) : (
              "Billed on your next monthly invoice"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {state === "coming_soon" && (
            <Tooltip content="We're building this. It'll appear here to activate when it's ready.">
              <span className="inline-block">
                <Button type="button" variant="secondary" size="sm" disabled>
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Coming soon
                </Button>
              </span>
            </Tooltip>
          )}

          {state === "not_subscribed" && (
            <Tooltip
              content={
                isFree
                  ? "Turn this on for your agency. No charge — it's part of your plan."
                  : "Turns on immediately. Nothing is charged today; it goes on your next monthly invoice."
              }
            >
              <Button type="button" variant="secondary" size="sm" onClick={onActivate}>
                Activate
              </Button>
            </Tooltip>
          )}

          {isOn && integration.setupHref && (
            <Tooltip
              content={
                state === "pending_setup"
                  ? "Finish connecting this before it can be used."
                  : "Change how this integration is configured."
              }
            >
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={integration.setupHref}>
                  <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                  {state === "pending_setup" ? "Finish setup" : "Configure"}
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </Tooltip>
          )}

          {/* Setup that isn't the agency's to do. Says so, rather than offering
              a button that leads to a screen where they have no permissions. */}
          {state === "pending_setup" && !integration.setupHref &&
            integration.setupOwner === "harbor_ops" && (
              <Tooltip content="This scheme issues credentials per agency, and we apply them for you. Send us your account details and we'll finish it.">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-inset px-2.5 py-1.5 text-[11px] font-medium text-foreground-secondary">
                  <MailCheck className="h-3.5 w-3.5" aria-hidden />
                  We&apos;ll set this up
                </span>
              </Tooltip>
            )}

          {state === "ending" && (
            <Tooltip content="Turn it back on. Billing resumes from your next invoice.">
              <Button type="button" variant="secondary" size="sm" onClick={onActivate}>
                Reactivate
              </Button>
            </Tooltip>
          )}

          {(state === "active" || state === "pending_setup") && (
            <Tooltip content="Stops the charge at the end of this month. You keep access until then.">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-[11px] font-medium text-red-600 transition-colors hover:text-red-700 hover:underline md:min-h-0 md:min-w-0"
              >
                Cancel
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
