"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Trash2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disconnectMydeposits } from "../actions/connection";
import type { MydepositsConnection } from "../domain/types";

const ERROR_LABELS: Record<string, string> = {
  missing_code: "The authorization response was incomplete. Please try again.",
  invalid_state: "Your connect session expired. Please try again.",
  connect_failed: "Could not complete the connection. Please try again.",
  headless_not_supported:
    "This account is set to headless (email/SMS) auth, which has no in-app connect flow yet. Connect via the mydeposits headless login script.",
};

export function MydepositsConnectionCard({ connection }: { connection: MydepositsConnection | null }) {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (searchParams.get("connected")) {
      toast.success("Connected to mydeposits");
    }
    const err = searchParams.get("error");
    if (err) {
      toast.error(ERROR_LABELS[err] ?? "Failed to connect to mydeposits");
    }
  }, [searchParams]);

  const onDisconnect = () => {
    startTransition(async () => {
      try {
        await disconnectMydeposits();
        toast.success("Disconnected from mydeposits");
        setConfirming(false);
      } catch {
        toast.error("Failed to disconnect");
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <ShieldCheck className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground">mydeposits (Total Property)</h2>
          <p className="text-xs text-foreground-secondary">
            Secure and release tenancy deposits from your contracts.
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            connection ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          {connection ? "Connected" : "Not connected"}
        </span>
      </div>

      {connection ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-foreground-muted">Environment</dt>
              <dd className="text-foreground capitalize">{connection.environment}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-foreground-muted">Last synced</dt>
              <dd className="text-foreground">
                {connection.last_synced_at
                  ? new Date(connection.last_synced_at).toLocaleString("en-GB")
                  : "Never"}
              </dd>
            </div>
          </dl>

          {confirming ? (
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" loading={isPending} onClick={onDisconnect}>
                <Trash2 className="h-3.5 w-3.5" />
                Confirm disconnect
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          )}
        </div>
      ) : (
        <Button asChild variant="secondary">
          <a href="/api/mydeposits/connect">
            <Plug className="h-4 w-4" />
            Connect to mydeposits
          </a>
        </Button>
      )}
    </div>
  );
}
