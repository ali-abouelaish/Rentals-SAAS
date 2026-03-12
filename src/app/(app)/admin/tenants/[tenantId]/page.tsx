import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getTenantDetails } from "@/features/admin/data/admin";
import { EditTenantDialog } from "@/features/admin/ui/EditTenantDialog";
import { TenantStatusActionButton } from "@/features/admin/ui/TenantStatusActionButton";
import { ArrowLeft, Palette, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";

export default async function AdminTenantDetailsPage({
  params
}: {
  params: { tenantId: string };
}) {
  const tenant = await getTenantDetails(params.tenantId);
  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/tenants">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Tenants
          </Link>
        </Button>
      </div>

      <PageHeader
        title={tenant.name}
        subtitle={`Tenant ID: ${tenant.id}`}
        action={
          <>
            <EditTenantDialog
              tenantId={tenant.id}
              initialName={tenant.name}
              initialSlug={tenant.slug}
            />
            <TenantStatusActionButton tenantId={tenant.id} currentStatus={tenant.status} />
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-foreground-muted">Slug</p>
            <p className="text-sm font-mono text-foreground mt-1">{tenant.slug}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">Status</p>
            <div className="mt-1">
              <StatusBadge status={tenant.status} size="sm" />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">Created</p>
            <p className="text-sm text-foreground mt-1">{formatDate(tenant.created_at)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">Branding</p>
            <p className="text-sm text-foreground mt-1">
              {tenant.brandingConfigured ? "Configured" : "Not configured"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-brand" />
              <p className="text-sm font-medium text-foreground">Tenant Users</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{tenant.usersCount}</p>
            <p className="text-xs text-foreground-muted">{tenant.activeUsersCount} active</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={`/admin/tenants/${tenant.id}/users`}>Manage Users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="h-4 w-4 text-brand" />
              <p className="text-sm font-medium text-foreground">Branding & Theme</p>
            </div>
            <p className="text-sm text-foreground-secondary">
              Manage logo, colors, theme mode, and tenant visual identity.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={`/admin/tenants/${tenant.id}/branding`}>Manage Branding</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-brand" />
              <p className="text-sm font-medium text-foreground">Profiles & Permissions</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{tenant.profilesCount}</p>
            <p className="text-xs text-foreground-muted">Access profiles configured</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={`/admin/tenants/${tenant.id}/profiles`}>Manage Profiles</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <SlidersHorizontal className="h-4 w-4 text-brand" />
              <p className="text-sm font-medium text-foreground">Feature Access</p>
            </div>
            <p className="text-sm text-foreground-secondary">
              Enable or disable modules per tenant and set optional end dates.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={`/admin/tenants/${tenant.id}/features`}>Manage Features</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

