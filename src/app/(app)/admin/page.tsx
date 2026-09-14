import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleDollarSign,
  Clock,
  FileText,
  HeartPulse,
  Mail,
  PauseCircle,
  ShieldCheck,
  Users
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getAdminOverviewStats, getTenants } from "@/features/admin/data/admin";
import { getAdminOverview } from "@/features/admin/data/overview";
import { getSystemHealth } from "@/features/admin/data/health";
import { getRecentPlatformAudit } from "@/features/admin/data/audit";
import { InviteSuperAdminDialog } from "@/features/admin/ui/InviteSuperAdminDialog";
import { formatPence } from "@/lib/envelopes/packs";
import { cn } from "@/lib/utils/cn";

type StatTile = {
  label: string;
  value: string;
  helper: string;
  icon: typeof Building2;
  tooltip: string;
  href?: string;
  emphasis?: "warning";
};

function StatGrid({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => {
        const body = (
          <Card
            className={cn(
              "h-full",
              tile.href && "hover:bg-surface-inset transition-colors",
              tile.emphasis === "warning" && "border-amber-300"
            )}
          >
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-foreground-muted">
                    {tile.label}
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold mt-1",
                      tile.emphasis === "warning" ? "text-amber-700" : "text-foreground"
                    )}
                  >
                    {tile.value}
                  </p>
                  <p className="text-xs text-foreground-secondary mt-1">{tile.helper}</p>
                </div>
                <div
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center",
                    tile.emphasis === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-brand-subtle text-brand"
                  )}
                >
                  <tile.icon className="h-4 w-4" aria-hidden />
                </div>
              </div>
            </CardContent>
          </Card>
        );

        return (
          <Tooltip key={tile.label} content={tile.tooltip}>
            {tile.href ? (
              <Link href={tile.href} className="block h-full">
                {body}
              </Link>
            ) : (
              <div className="h-full">{body}</div>
            )}
          </Tooltip>
        );
      })}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const [stats, { tenants }, overview, health, recentAudit] = await Promise.all([
    getAdminOverviewStats(),
    getTenants({ page: 1 }),
    getAdminOverview(),
    // 24-hour window: this page is a glance, and the health page owns the longer views.
    getSystemHealth({ windowHours: 24 }),
    getRecentPlatformAudit(6)
  ]);

  const { revenue } = overview;

  const revenueTiles: StatTile[] = [
    {
      label: "MRR",
      value: formatPence(revenue.mrrPence),
      helper: `${revenue.subscriptionCount} billable subscription${
        revenue.subscriptionCount === 1 ? "" : "s"
      }`,
      icon: CircleDollarSign,
      tooltip:
        "Monthly recurring revenue from integration subscriptions that will actually be billed this period. Grandfathered and free subscriptions are excluded, and so are any whose billing has not started yet — this uses the same rule as the invoice run, so the two cannot disagree."
    },
    {
      label: "Invoiced this month",
      value: formatPence(revenue.draftPence + revenue.issuedPence + revenue.paidPence),
      helper: `${formatPence(revenue.draftPence)} still draft`,
      icon: FileText,
      href: "/admin/billing",
      tooltip:
        "Everything raised for the current period, draft and issued and paid. Drafts have not been sent to the agency yet."
    },
    {
      label: "Outstanding",
      value: formatPence(revenue.outstandingPence),
      helper: "Issued and unpaid, any period",
      icon: Clock,
      href: "/admin/billing",
      tooltip:
        "Money owed across every period, not just this month — debt from August is still debt in September."
    },
    {
      label: "Overdue 30+ days",
      value: formatPence(revenue.overduePence),
      helper: `${revenue.overdueCount} invoice${revenue.overdueCount === 1 ? "" : "s"}`,
      icon: AlertTriangle,
      href: "/admin/billing",
      emphasis: revenue.overduePence > 0 ? "warning" : undefined,
      tooltip: "Issued more than 30 days ago and still not marked paid. Worth a chase."
    }
  ];

  const estateTiles: StatTile[] = [
    {
      label: "Agencies",
      value: String(stats.tenantsCount),
      helper: `${stats.activeTenantsCount} active`,
      icon: Building2,
      href: "/admin/tenants",
      tooltip: "Every tenant on the platform, active or not."
    },
    {
      label: "Suspended",
      value: String(stats.suspendedTenantsCount),
      helper: "No access to the app",
      icon: PauseCircle,
      href: "/admin/tenants?status=suspended",
      emphasis: stats.suspendedTenantsCount > 0 ? "warning" : undefined,
      tooltip:
        "Suspended or inactive agencies. Their users cannot sign in, so a suspension left in place by mistake is a customer sitting locked out."
    },
    {
      label: "Users",
      value: String(stats.usersCount),
      helper: `${stats.activeUsersCount} active`,
      icon: Users,
      tooltip: "User profiles across all agencies, including super admins."
    },
    {
      label: "Unbilled envelopes",
      value: formatPence(revenue.unbilledEnvelopePence),
      helper: `${revenue.unbilledEnvelopeCount} purchase${
        revenue.unbilledEnvelopeCount === 1 ? "" : "s"
      }`,
      icon: Mail,
      href: "/admin/billing",
      tooltip:
        "E-signing top-ups bought but not yet on an invoice. They are claimed by the next generation run for the period they were sold into."
    }
  ];

  const healthTiles: StatTile[] = [
    {
      label: "Job failures 24h",
      value: String(health.counts.jobFailures),
      helper: "Across all recurring jobs",
      icon: HeartPulse,
      href: "/admin/health",
      emphasis: health.counts.jobFailures > 0 ? "warning" : undefined,
      tooltip:
        "Scheduled jobs that threw in the last day. These used to go to the process log only, where nobody saw them."
    },
    {
      label: "Stale jobs",
      value: String(health.counts.staleJobs),
      helper: "No successful run recently",
      icon: Clock,
      href: "/admin/health",
      emphasis: health.counts.staleJobs > 0 ? "warning" : undefined,
      tooltip:
        "Jobs that have not completed within their expected window. A job that stops firing produces no error at all, so this is the only way it shows up."
    },
    {
      label: "Email failures 24h",
      value: String(health.counts.emailFailures),
      helper: "Failed sends",
      icon: Mail,
      href: "/admin/health",
      emphasis: health.counts.emailFailures > 0 ? "warning" : undefined,
      tooltip: "Sends that failed outright, across every agency and provider."
    },
    {
      label: "Integration errors 24h",
      value: String(health.counts.integrationErrors),
      helper: "Deposit APIs and webhooks",
      icon: AlertTriangle,
      href: "/admin/health",
      emphasis: health.counts.integrationErrors > 0 ? "warning" : undefined,
      tooltip:
        "Failed calls to mydeposits, TDS or DPS, plus BoldSign webhooks that could not be processed."
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Overview"
        subtitle="What the platform is earning, what it is doing, and what needs a human."
        action={<InviteSuperAdminDialog />}
      />

      {overview.unavailable.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-foreground">Some figures are incomplete</p>
                <p className="text-foreground-secondary mt-1">
                  Could not read: {overview.unavailable.join(", ")}. Migrations are applied
                  by hand in this project — the numbers below understate reality until they
                  are.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Revenue
        </h2>
        <StatGrid tiles={revenueTiles} />
      </section>

      {overview.attention.length > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">Needs attention</h2>
            <div className="space-y-2">
              {overview.attention.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-surface-inset transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                        item.severity === "warning"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-brand-subtle text-brand"
                      )}
                    >
                      {item.count}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      <span className="block text-xs text-foreground-secondary mt-0.5">
                        {item.detail}
                      </span>
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Platform health
        </h2>
        <StatGrid tiles={healthTiles} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Estate
        </h2>
        <StatGrid tiles={estateTiles} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Recent agencies</h2>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/tenants">
                  View all
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" aria-hidden />
                </Link>
              </Button>
            </div>
            {tenants.length > 0 ? (
              <div className="space-y-2">
                {tenants.slice(0, 6).map((tenant) => (
                  <Link
                    key={tenant.id}
                    href={`/admin/tenants/${tenant.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-inset transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {tenant.name}
                      </p>
                      <p className="text-xs text-foreground-muted">{tenant.slug}</p>
                    </div>
                    <StatusBadge status={tenant.status} size="sm" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-foreground-secondary">
                No agencies yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Recent admin actions</h2>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/activity">
                  Full log
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" aria-hidden />
                </Link>
              </Button>
            </div>
            {recentAudit.length > 0 ? (
              <div className="space-y-2">
                {recentAudit.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-border p-3 text-xs space-y-0.5"
                  >
                    <p className="text-foreground">{row.summary}</p>
                    <p className="text-foreground-muted">
                      {row.actor_name ?? row.actor_email ?? "System"}
                      {" · "}
                      {new Date(row.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Activity
                  className="h-8 w-8 mx-auto text-foreground-muted mb-2"
                  aria-hidden
                />
                <p className="text-sm text-foreground-secondary">
                  Nothing recorded yet. Super-admin actions appear here once the audit
                  migration is applied.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-foreground-muted">
        Activity in the last 7 days: {stats.activityCountLast7Days} tenant events ·{" "}
        {stats.profilesCount} access profiles configured
        {" · "}
        <Link href="/admin/health" className="hover:underline">
          <ShieldCheck className="inline h-3 w-3 mr-0.5" aria-hidden />
          system health
        </Link>
      </p>
    </div>
  );
}
