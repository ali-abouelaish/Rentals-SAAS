"use client";

import Link from "next/link";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import type { EarningsLeaderboardRow } from "../domain/types";

export function AllAgentsTable({ rows }: { rows: EarningsLeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-foreground-muted text-sm">
        No agents in this period
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-foreground-muted font-medium">
            <th className="pb-3 pr-4 w-14">Rank</th>
            <th className="pb-3 pr-4">Agent</th>
            <th className="pb-3 pr-4 text-right tabular-nums">Rentals</th>
            <th className="pb-3 pr-4 text-right tabular-nums">Earnings</th>
            <th className="pb-3 pr-4 text-right tabular-nums">Commission</th>
            <th className="pb-3 pl-4 text-right">Last Active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.agent_id}>
              <td className="py-3 pr-4 tabular-nums text-foreground-muted">{row.rank}</td>
              <td className="py-3 pr-4">
                <Link
                  href={`/agents/${row.agent_id}`}
                  className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg -m-1 p-1"
                >
                  <div className="h-9 w-9 shrink-0">
                    <AvatarCircle name={row.agent_name} url={row.avatar_url} />
                  </div>
                  <span className="font-medium text-foreground group-hover:text-brand">
                    {row.agent_name}
                  </span>
                </Link>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">{row.transactions_count}</td>
              <td className="py-3 pr-4 text-right tabular-nums font-medium">
                {formatGBP(row.agent_earnings)}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums text-foreground-muted">
                {row.commission_percent != null ? `${row.commission_percent}%` : "—"}
              </td>
              <td className="py-3 pl-4 text-right text-foreground-muted">
                {row.last_activity ? formatDate(row.last_activity) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
