"use client";

// Shared e-signature panel: current status, and a button to send.
//
// Used by works orders and contracts, which differ only in their actions and
// their copy. The behaviour that matters is identical, and worth having in one
// place:
//
//   - Status is loaded when the panel mounts, not passed down. It changes
//     outside the app — a signer completing fires a webhook, with nothing here
//     to trigger a re-render — so stale props would be worse than a fetch.
//   - A disabled button says why. "Send" greyed out with no explanation is the
//     kind of dead end people file a support ticket about.
//   - Only terminal states offer a re-send, mirroring the one-active-per-entity
//     index in the database rather than duplicating its rules by eye.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Mail, PenLine, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { isLowBalance, type EnvelopeBalance } from "@/lib/envelopes/packs";
import { getEnvelopeBalanceAction } from "@/features/integrations/actions/envelopes";
import { BuyEnvelopesDialog } from "@/features/integrations/ui/BuyEnvelopesDialog";

export type SigningPanelState = {
  /**
   * False when the agency has not subscribed to the e-signing integration.
   *
   * Carried on the state rather than passed as a prop because the panels are
   * rendered from client drawers that have no access to entitlements, and
   * because it changes outside this component — an admin activating the
   * integration in another tab should not need a reload of the drawer.
   */
  entitled: boolean;
  status: string | null;
  sentAt: string | null;
  completedAt: string | null;
  isSandbox: boolean;
};

type Props = {
  /** Reads the current signing state. Called on mount and after a send. */
  loadState: () => Promise<SigningPanelState>;
  /** Shown in place of the send button when the integration isn't subscribed. */
  upsellHint: string;
  /**
   * Performs the send. Returns `{ error }` to be surfaced as a toast, except
   * `code: "out_of_envelopes"` which opens the purchase dialog instead.
   */
  onSend: () => Promise<
    | { success: true; documentId: string }
    | { error: string; code?: "already_in_flight" | "out_of_envelopes" }
  >;
  /** Non-null disables the button and explains why, in the tooltip and hint. */
  blockedReason?: string | null;
  /** What the button does, for the tooltip when it is enabled. */
  sendTooltip: string;
  /** Shown under the button before anything has been sent. */
  idleHint: string;
  /** Shown once signed. */
  completedHint: string;
  /** Shown while out for signature. */
  pendingHint: string;
  successMessage: string;
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_signature: "Awaiting signature",
  partially_signed: "Partially signed",
  completed: "Signed",
  declined: "Declined",
  expired: "Expired",
  revoked: "Revoked",
  failed: "Send failed",
};

const STATUS_STYLES: Record<string, string> = {
  awaiting_signature: "bg-amber-100 text-amber-800",
  partially_signed: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
  expired: "bg-neutral-200 text-neutral-700",
  revoked: "bg-neutral-200 text-neutral-700",
  failed: "bg-red-100 text-red-800",
};

/** Terminal states can be re-sent; in-flight ones must not be. */
const IN_FLIGHT = new Set(["awaiting_signature", "partially_signed"]);

function formatWhen(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SigningPanel({
  loadState,
  onSend,
  upsellHint,
  blockedReason,
  sendTooltip,
  idleHint,
  completedHint,
  pendingHint,
  successMessage,
}: Props) {
  const [state, setState] = useState<SigningPanelState | null>(null);
  const [balance, setBalance] = useState<EnvelopeBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  // True when the dialog was opened by a blocked send, so a successful
  // purchase can finish what the user was actually trying to do rather than
  // leaving them to click Send again.
  const [retryAfterBuy, setRetryAfterBuy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextState, nextBalance] = await Promise.all([
        loadState(),
        getEnvelopeBalanceAction().catch(() => null),
      ]);
      setState(nextState);
      setBalance(nextBalance);
    } finally {
      setLoading(false);
    }
  }, [loadState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      const result = await onSend();
      if ("error" in result) {
        if (result.code === "out_of_envelopes") {
          // Not a toast. This is the one failure the user can resolve without
          // leaving the drawer, so offer the fix in place.
          setRetryAfterBuy(true);
          setBuyOpen(true);
          return;
        }
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      await refresh();
    } finally {
      setSending(false);
    }
  }, [onSend, refresh, successMessage]);

  const status = state?.status ?? null;
  const inFlight = status !== null && IN_FLIGHT.has(status);
  const sentAt = formatWhen(state?.sentAt ?? null);
  const completedAt = formatWhen(state?.completedAt ?? null);

  const outOfEnvelopes = balance !== null && balance.remaining === 0;

  const disabledReason =
    blockedReason ??
    (inFlight
      ? "This is already out for signature. Wait for it to be signed, or revoke it in BoldSign first."
      : null);

  // Deliberately not folded into `disabledReason`: the button stays clickable
  // and becomes the way to buy. Disabling it would leave someone stuck with an
  // explanation and no action.
  const envelopeHint = (() => {
    if (!balance) return null;
    if (outOfEnvelopes) return "No envelopes left — each send uses one.";
    if (isLowBalance(balance)) {
      return `${balance.remaining} ${balance.remaining === 1 ? "envelope" : "envelopes"} left.`;
    }
    return null;
  })();

  return (
    <div>
      <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
        E-signature
      </p>

      {loading ? (
        <p className="text-[11px] text-foreground-muted">Checking signing status…</p>
      ) : state && !state.entitled ? (
        /* Not subscribed. Say what the feature does and where to get it, rather
           than hiding the panel — an admin who doesn't know the capability
           exists will never go looking for it in Settings. */
        <div className="rounded-lg border border-border bg-surface-inset p-3">
          <div className="flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-foreground-muted" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs text-foreground-secondary leading-relaxed">{upsellHint}</p>
              <Tooltip content="Turns on immediately. Nothing is charged today — it goes on your next monthly invoice.">
                <Link
                  href="/settings/integrations"
                  className="mt-1.5 inline-block text-[11px] font-medium text-brand hover:underline"
                >
                  Activate e-signing →
                </Link>
              </Tooltip>
            </div>
          </div>
        </div>
      ) : (
        <>
          {status && (
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  STATUS_STYLES[status] ?? "bg-neutral-200 text-neutral-700"
                )}
              >
                {STATUS_LABELS[status] ?? status}
              </span>
              {state?.isSandbox && (
                <Tooltip content="Sent from the BoldSign sandbox — not a binding agreement.">
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                    Sandbox
                  </span>
                </Tooltip>
              )}
              <button
                type="button"
                onClick={() => void refresh()}
                className="text-foreground-muted hover:text-foreground transition-colors"
                aria-label="Refresh signing status"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <Tooltip
            content={
              disabledReason ??
              (outOfEnvelopes
                ? "You have no envelopes left. Buy a pack and this sends straight away."
                : sendTooltip)
            }
          >
            {/* A span wrapper so the tooltip still fires on a disabled button —
                disabled elements emit no pointer events. */}
            <span className="inline-block">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (outOfEnvelopes) {
                    setRetryAfterBuy(true);
                    setBuyOpen(true);
                    return;
                  }
                  void handleSend();
                }}
                disabled={sending || Boolean(disabledReason)}
              >
                {outOfEnvelopes ? (
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <PenLine className="h-3.5 w-3.5 mr-1.5" />
                )}
                {sending
                  ? "Sending…"
                  : outOfEnvelopes
                    ? "Buy envelopes to send"
                    : status
                      ? "Send again"
                      : "Send for signature"}
              </Button>
            </span>
          </Tooltip>

          <p className="text-[11px] text-foreground-muted mt-1.5">
            {completedAt
              ? `${completedHint} Signed ${completedAt}.`
              : sentAt && inFlight
                ? `Sent ${sentAt}. ${pendingHint}`
                : blockedReason ?? idleHint}
          </p>

          {envelopeHint && (
            <p
              className={cn(
                "text-[11px] mt-1",
                outOfEnvelopes ? "text-amber-700 font-medium" : "text-foreground-muted"
              )}
            >
              {envelopeHint}{" "}
              <button
                type="button"
                onClick={() => {
                  setRetryAfterBuy(false);
                  setBuyOpen(true);
                }}
                className="underline hover:no-underline"
              >
                Buy more
              </button>
            </p>
          )}
        </>
      )}

      <BuyEnvelopesDialog
        open={buyOpen}
        balance={balance}
        blockedContext={retryAfterBuy}
        onClose={() => {
          setBuyOpen(false);
          setRetryAfterBuy(false);
        }}
        onPurchased={() => {
          // Finish the send they were blocked on. Buying was a means to an
          // end; making them click Send again would be a second hurdle after
          // the one they just cleared.
          if (retryAfterBuy) void handleSend();
          else void refresh();
        }}
      />
    </div>
  );
}
