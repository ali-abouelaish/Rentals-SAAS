import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAdminOverviewStats, getTenants } from "@/features/admin/data/admin";
import { Building2, Users, ShieldCheck, Activity, ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InviteSuperAdminDialog } from "@/features/admin/ui/InviteSuperAdminDialog";

export default async function AdminOverviewPage() {
  const [stats, { tenants }] = await Promise.all([
    getAdminOverviewStats(),
    getTenants({ page: 1 })
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Super Admin Overview"
        subtitle="Global tenant operations, users, access profiles, and audit activity."
        action={<InviteSuperAdminDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Tenants",
            value: stats.tenantsCount,
            icon: Building2,
            helper: `${stats.activeTenantsCount} active`
          },
          {
            label: "Suspended Tenants",
            value: stats.suspendedTenantsCount,
            icon: ShieldCheck,
            helper: "Require review"
          },
          {
            label: "Users",
            value: stats.usersCount,
            icon: Users,
            helper: `${stats.activeUsersCount} active`
          },
          {
            label: "Activity (7d)",
            value: stats.activityCountLast7Days,
            icon: Activity,
            helper: "Recent actions"
          }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-foreground-muted">
                    {item.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">{item.value}</p>
                  <p className="text-xs text-foreground-secondary mt-1">{item.helper}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-brand-subtle text-brand flex items-center justify-center">
                  <item.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Recent Tenants</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/tenants">
                View all
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
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
                  <div>
                    <p className="text-sm font-medium text-foreground">{tenant.name}</p>
                    <p className="text-xs text-foreground-muted">{tenant.slug}</p>
                  </div>
                  <StatusBadge status={tenant.status} size="sm" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-foreground-secondary">
              No tenants yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

