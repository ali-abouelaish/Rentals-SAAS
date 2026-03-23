"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RefreshCw, Mail } from "lucide-react";
import { disconnectGmail, syncGmail } from "../actions/gmail";
import type { TenantGmailConnection } from "../domain/types";

interface Props {
  connection: TenantGmailConnection | null;
}

export function GmailConnectionCard({ connection }: Props) {
  const [isSyncing, startSync] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();

  const handleSync = () => {
    startSync(async () => {
      try {
        const result = await syncGmail();
        toast.success(`Synced — ${result.created} new lead${result.created !== 1 ? "s" : ""}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sync failed");
      }
    });
  };

  const handleDisconnect = () => {
    startDisconnect(async () => {
      try {
        await disconnectGmail();
        toast.success("Gmail disconnected");
      } catch {
        toast.error("Failed to disconnect Gmail");
      }
    });
  };

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-foreground-muted" />
        <h2 className="text-sm font-semibold text-foreground">Gmail Connection</h2>
      </div>

      <div className="flex items-center gap-3">
        {connection ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-foreground-muted shrink-0" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">
            {connection ? connection.gmail_address : "Not connected"}
          </p>
          {connection && (
            <p className="text-xs text-foreground-muted">
              Token expires:{" "}
              {new Date(connection.token_expiry).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {!connection ? (
          <a
            href="/api/gmail/connect"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
          >
            <Mail className="h-4 w-4" />
            Connect Gmail
          </a>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing…" : "Sync now"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="inline-flex items-center gap-2 rounded-lg border border-status-error-border px-4 py-2 text-sm font-medium text-status-error-fg hover:bg-status-error-bg transition-colors disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
