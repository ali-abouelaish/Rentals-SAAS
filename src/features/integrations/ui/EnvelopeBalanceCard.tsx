"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { isLowBalance, type EnvelopeBalance } from "@/lib/envelopes/packs";
import { BuyEnvelopesDialog } from "./BuyEnvelopesDialog";

export function EnvelopeBalanceCard({ balance }: { balance: EnvelopeBalance }) {
  const [buyOpen, setBuyOpen] = useState(false);

  const empty = balance.remaining === 0;
  const low = isLowBalance(balance);

  return (
    <section className="rounded-xl border border-border bg-surface-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Envelopes</h2>
          <p className="text-xs text-foreground-secondary mt-0.5">
            One envelope is used each time you send a document for signature,
            however many people sign it.
          </p>
        </div>
        <Tooltip content="Purchased envelopes never expire. Nothing is charged today — it goes on your next invoice.">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setBuyOpen(true)}
          >
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Buy envelopes
          </Button>
        </Tooltip>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
          className={cn(
            "rounded-lg p-2.5",
            empty
              ? "bg-amber-50 border border-amber-300"
              : low
                ? "bg-amber-50"
                : "bg-surface-inset"
          )}
        >
          <p
            className={cn(
              "text-lg font-semibold leading-none",
              empty || low ? "text-amber-800" : "text-foreground"
            )}
          >
            {balance.remaining}
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">Available now</p>
        </div>

        <div className="rounded-lg bg-surface-inset p-2.5">
          <p className="text-lg font-semibold text-foreground leading-none">
            {balance.allowanceRemaining}
            <span className="text-xs font-normal text-foreground-muted">
              {" "}
              / {balance.allowanceTotal}
            </span>
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">
            Included this month
          </p>
        </div>

        <div className="rounded-lg bg-surface-inset p-2.5">
          <p className="text-lg font-semibold text-foreground leading-none">
            {balance.topupRemaining}
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">Purchased</p>
        </div>

        <div className="rounded-lg bg-surface-inset p-2.5">
          <p className="text-lg font-semibold text-foreground leading-none">
            {balance.lifetimeSent}
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">Sent all time</p>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-foreground-muted leading-relaxed">
        {empty ? (
          <span className="text-amber-800 font-medium">
            You can&apos;t send anything for signature until you buy more.
          </span>
        ) : (
          <>
            Your included {balance.allowanceTotal} reset on the 1st and don&apos;t
            carry over. Purchased envelopes never expire, and are only used once
            the included ones are gone.
          </>
        )}
      </p>

      <BuyEnvelopesDialog
        open={buyOpen}
        balance={balance}
        onClose={() => setBuyOpen(false)}
      />
    </section>
  );
}
