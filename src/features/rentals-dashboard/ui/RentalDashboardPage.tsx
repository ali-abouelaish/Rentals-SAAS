"use client";

import Link from "next/link";
import {
  Users,
  FileText,
  TrendingUp,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  BarChart3,
} from "lucide-react";
import type { RentalDashboardData } from "../data/queries";

function fmt(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  pending:  { label: "Pending",  bg: "bg-amber-100",  fg: "text-amber-800",  dot: "bg-amber-400"  },
  approved: { label: "Approved", bg: "bg-blue-100",   fg: "text-blue-800",   dot: "bg-blue-500"   },
  paid:     { label: "Paid",     bg: "bg-green-100",  fg: "text-green-800",  dot: "bg-green-500"  },
  refunded: { label: "Refunded", bg: "bg-gray-100",   fg: "text-gray-700",   dot: "bg-gray-400"   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.fg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

interface Props {
  data: RentalDashboardData;
  userName: string;
  isAdmin: boolean;
}

export function RentalDashboardPage({ data, userName, isAdmin }: Props) {
  const { stats, statusBreakdown, recentRentals, topAgents } = data;

  const statCards = [
    {
      label: "Rentals this month",
      value: stats.rentalsThisMonth,
      icon: FileText,
      color: "text-brand",
      bg: "bg-brand/10",
    },
    {
      label: "Revenue this month",
      value: fmt(stats.revenueThisMonthPence),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Pending approvals",
      value: stats.pendingCount,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Total clients",
      value: stats.totalClients,
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-foreground-secondary">Welcome back, {userName}</p>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Rental Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-bento bg-surface-card shadow-bento p-5">
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.bg} mb-3`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-foreground-muted mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent rentals */}
        <div className="lg:col-span-2 rounded-bento bg-surface-card shadow-bento overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Rentals</h2>
            <Link href="/rentals" className="text-xs text-brand hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentRentals.length === 0 ? (
            <div className="py-12 text-center text-sm text-foreground-muted">No rentals yet</div>
          ) : (
            <div className="divide-y divide-border">
              {recentRentals.map((r) => (
                <Link
                  key={r.id}
                  href={`/rentals/${r.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-surface-inset transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-brand transition-colors">
                      {r.clientName}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {r.code} · {r.agentName} · {fmtDate(r.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <StatusBadge status={r.status} />
                    <span className="text-sm font-medium text-foreground">{fmt(r.amount)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Status breakdown */}
          <div className="rounded-bento bg-surface-card shadow-bento p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand" />
              All-time breakdown
            </h2>
            <div className="space-y-2.5">
              {statusBreakdown.map((s) => {
                const cfg = STATUS_CONFIG[s.status];
                const total = statusBreakdown.reduce((a, b) => a + b.count, 0) || 1;
                const pct = Math.round((s.count / total) * 100);
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-foreground-secondary capitalize">{s.status}</span>
                      <span className="font-medium text-foreground">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cfg?.dot ?? "bg-brand"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top agents — admin only */}
          {isAdmin && topAgents.length > 0 && (
            <div className="rounded-bento bg-surface-card shadow-bento p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-brand" />
                Top agents this month
              </h2>
              <div className="space-y-3">
                {topAgents.map((a, i) => (
                  <div key={a.agentId} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-foreground-muted text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.agentName}</p>
                      <p className="text-xs text-foreground-muted">{a.rentalsCount} rental{a.rentalsCount !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">{fmt(a.revenueThisMonth)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="rounded-bento bg-surface-card shadow-bento p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Quick actions</h2>
            <div className="space-y-1.5">
              {[
                { href: "/rentals/new", label: "New rental", icon: CheckCircle2 },
                { href: "/clients/new", label: "Add client", icon: Users },
                { href: "/rentals?status=pending", label: "Review pending", icon: Clock },
                ...(isAdmin ? [{ href: "/invoices/new", label: "Create invoice", icon: XCircle }] : []),
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground-secondary hover:bg-surface-inset hover:text-foreground transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-brand" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
