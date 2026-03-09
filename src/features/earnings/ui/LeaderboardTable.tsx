"use client";

import Link from "next/link";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import type { EarningsLeaderboardRow } from "../domain/types";
import { Button } from "@/components/ui/button";
import { Crown, Medal, ArrowRight } from "lucide-react";

/* ── Podium Card ────────────────────────────── */
function PodiumCard({
  row,
  place,
  showAgencyTotals,
}: {
  row: EarningsLeaderboardRow;
  place: 1 | 2 | 3;
  showAgencyTotals: boolean;
}) {
  const config = {
    1: {
      height: "h-full",
      bg: "bg-gradient-to-br from-amber-50 to-orange-50",
      ring: "ring-2 ring-amber-300/60",
      icon: <Crown className="h-5 w-5 text-amber-500" strokeWidth={2} />,
      badge: "bg-amber-100 text-amber-700",
      label: "1st Place",
      avatarSize: "h-14 w-14",
    },
    2: {
      height: "h-[92%] self-end",
      bg: "bg-gradient-to-br from-slate-50 to-gray-100",
      ring: "ring-1 ring-gray-200",
      icon: <Medal className="h-4 w-4 text-gray-500" strokeWidth={2} />,
      badge: "bg-gray-100 text-gray-600",
      label: "2nd Place",
      avatarSize: "h-12 w-12",
    },
    3: {
      height: "h-[84%] self-end",
      bg: "bg-gradient-to-br from-orange-50 to-amber-50/50",
      ring: "ring-1 ring-amber-200/60",
      icon: <Medal className="h-4 w-4 text-amber-600/60" strokeWidth={2} />,
      badge: "bg-amber-50 text-amber-700",
      label: "3rd Place",
      avatarSize: "h-12 w-12",
    },
  }[place];

  const href = `/agents/${row.agent_id}`;

  return (
    <Link
      href={href}
      className={`${config.height} ${config.bg} ${config.ring} rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-all duration-base hover:shadow-bento-hover hover:-translate-y-1 group cursor-pointer`}
    >
      {/* Crown / Medal */}
      <div className="mb-2">{config.icon}</div>

      {/* Avatar */}
      <div className={`${config.avatarSize} mb-3 flex items-center justify-center`}>
        <AvatarCircle name={row.agent_name} url={row.avatar_url} />
      </div>

      {/* Name */}
      <p className="text-sm font-semibold text-foreground mb-1 group-hover:text-brand transition-colors truncate max-w-full">
        {row.agent_name}
      </p>

      {/* Earnings */}
      <p className="text-lg font-bold text-foreground tabular-nums">
        {formatGBP(row.agent_earnings)}
      </p>

      {/* Commission */}
      <p className="text-xs text-foreground-muted mt-1">
        {row.commission_percent ? `${row.commission_percent}% commission` : "—"}
      </p>

      {/* Place badge */}
      <span className={`mt-3 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${config.badge}`}>
        {config.label}
      </span>
    </Link>
  );
}

/* ── Runner-up Row ──────────────────────────── */
function RunnerUpRow({
  row,
  showAgencyTotals,
}: {
  row: EarningsLeaderboardRow;
  showAgencyTotals: boolean;
}) {
  const href = `/agents/${row.agent_id}`;

  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-surface-inset transition-colors duration-base group"
    >
      <div className="flex items-center gap-3.5">
        <span className="w-6 text-center text-sm font-bold text-foreground-muted tabular-nums">
          {row.rank}
        </span>
        <div className="h-9 w-9">
          <AvatarCircle name={row.agent_name} url={row.avatar_url} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground group-hover:text-brand transition-colors">
            {row.agent_name}
          </p>
          <p className="text-xs text-foreground-muted">
            {row.commission_percent ? `${row.commission_percent}% commission` : "No commission"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {formatGBP(row.agent_earnings)}
          </p>
          {showAgencyTotals && (
            <p className="text-xs text-foreground-muted">
              Agency: {formatGBP(row.agency_earnings)}
            </p>
          )}
        </div>
        <p className="text-sm font-semibold text-foreground tabular-nums sm:hidden">
          {formatGBP(row.agent_earnings)}
        </p>
        {row.last_activity && (
          <span className="text-xs text-foreground-muted hidden lg:block">
            {formatDate(row.last_activity)}
          </span>
        )}
        <ArrowRight className="h-4 w-4 text-foreground-muted group-hover:text-brand transition-colors shrink-0" />
      </div>
    </Link>
  );
}

/* ── Main Component ─────────────────────────── */
export function LeaderboardTable({
  rows,
  showAgencyTotals
}: {
  rows: EarningsLeaderboardRow[];
  showAgencyTotals: boolean;
}) {
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // Reorder for podium: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-foreground-secondary">No agents found for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Podium — top 3 ───────────────── */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-3 items-end min-h-[260px]">
          {podiumOrder.map((row) => {
            if (!row) return <div key="empty" />;
            return (
              <PodiumCard
                key={row.agent_id}
                row={row}
                place={row.rank as 1 | 2 | 3}
                showAgencyTotals={showAgencyTotals}
              />
            );
          })}
        </div>
      )}

      {/* ── Remaining agents — compact list ── */}
      {rest.length > 0 && (
        <div>
          <div className="h-px bg-border mb-3" />
          <div className="space-y-0.5">
            {rest.map((row) => (
              <RunnerUpRow
                key={row.agent_id}
                row={row}
                showAgencyTotals={showAgencyTotals}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
