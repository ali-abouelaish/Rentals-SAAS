"use client";

import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import type { EarningsLeaderboardRow } from "../domain/types";
import { Button } from "@/components/ui/button";

function rankClass(rank: number) {
  if (rank === 1) return "border border-accent bg-accent/10";
  if (rank === 2) return "border border-muted bg-muted/60";
  if (rank === 3) return "border border-amber-200 bg-amber-50";
  return "";
}

export function LeaderboardTable({
  rows,
  showAgencyTotals
}: {
  rows: EarningsLeaderboardRow[];
  showAgencyTotals: boolean;
}) {
  return (
    <DataTable
      columns={[
        "Agent",
        "Agent Earnings",
        showAgencyTotals ? "Agency Earnings" : "Agency Earnings (restricted)",
        "Total Earnings",
        "Last Activity",
        "Actions"
      ]}
      rows={rows.map((row) => [
        <div
          key={`${row.agent_id}-agent`}
          className={`flex items-center gap-3 rounded-xl px-2 py-1 ${rankClass(row.rank)}`}
        >
          <AvatarCircle name={row.agent_name} url={row.avatar_url} />
          <div>
            <p className="text-sm font-medium text-brand">{row.agent_name}</p>
            <Badge className="border-muted text-gray-600">#{row.rank}</Badge>
          </div>
        </div>,
        <div key={`${row.agent_id}-earnings`} className="text-sm">
          <p className="font-medium text-brand">{formatGBP(row.agent_earnings)}</p>
          <p className="text-xs text-gray-500">
            {row.commission_percent ? `${row.commission_percent}% commission` : "No commission"}
          </p>
        </div>,
        <span key={`${row.agent_id}-agency`} className="text-sm text-gray-600">
          {showAgencyTotals ? formatGBP(row.agency_earnings) : "—"}
        </span>,
        <span key={`${row.agent_id}-total`} className="text-sm text-gray-600">
          {showAgencyTotals ? formatGBP(row.total_earnings) : "—"}
        </span>,
        <span key={`${row.agent_id}-activity`} className="text-sm text-gray-500">
          {row.last_activity ? formatDate(row.last_activity) : "—"}
        </span>,
        <Button key={`${row.agent_id}-action`} asChild variant="outline" size="sm">
          <Link
            href={
              showAgencyTotals
                ? `/admin/agents/${row.agent_id}/commission`
                : `/agents/${row.agent_id}`
            }
          >
            {showAgencyTotals ? "Commission File" : "View"}
          </Link>
        </Button>
      ])}
    />
  );
}
