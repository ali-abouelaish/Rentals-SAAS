"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { syncGmail } from "../actions/gmail";

export function SyncPlatformsButton() {
  const router = useRouter();
  const [isSyncing, startSync] = useTransition();

  const handleSync = () => {
    startSync(async () => {
      try {
        const result = await syncGmail();
        toast.success(
          `Synced all platforms — ${result.created} new lead${result.created !== 1 ? "s" : ""}`
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sync failed");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isSyncing}
      title="Pull the latest enquiries from every connected platform now"
      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
      {isSyncing ? "Syncing…" : "Sync all platforms"}
    </button>
  );
}
