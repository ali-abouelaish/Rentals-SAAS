import { Inbox, Clock, Flame } from "lucide-react";
import type { LeadStats } from "../data/leads";
import type { TenantGmailConnection } from "../domain/types";

interface Props {
  stats: LeadStats;
  connection: TenantGmailConnection | null;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function LeadSyncStatsCard({ stats, connection }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-foreground-muted" />
        <span className="text-sm font-semibold text-foreground">Leads Overview</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-inset border border-border p-3">
          <p className="text-2xl font-bold text-foreground">{stats.todayCount}</p>
          <p className="text-xs text-foreground-muted mt-0.5">Today</p>
        </div>
        <div className="rounded-lg bg-surface-inset border border-border p-3">
          <p className="text-2xl font-bold text-foreground">{stats.totalNew}</p>
          <p className="text-xs text-foreground-muted mt-0.5">New</p>
        </div>
      </div>

      <div className="space-y-2 text-xs text-foreground-muted">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Last sync:{" "}
            <span className="text-foreground-secondary">
              {formatRelativeTime(connection?.last_synced_at ?? null)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 shrink-0" />
          <span>
            Last lead:{" "}
            <span className="text-foreground-secondary">
              {formatRelativeTime(stats.lastLeadAt)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full shrink-0 ${connection ? "bg-green-500" : "bg-foreground-muted"}`}
          />
          <span>
            Gmail:{" "}
            <span className="text-foreground-secondary">
              {connection ? connection.gmail_address : "Not connected"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
