import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";
import { getTenantAccessProfiles, getTenantDetails } from "@/features/admin/data/admin";
import { TenantProfileDialog } from "@/features/admin/ui/TenantProfileDialog";
import { DeleteTenantProfileButton } from "@/features/admin/ui/DeleteTenantProfileButton";

export default async function AdminTenantProfilesPage({
  params
}: {
  params: { tenantId: string };
}) {
  const [tenant, profiles] = await Promise.all([
    getTenantDetails(params.tenantId),
    getTenantAccessProfiles(params.tenantId)
  ]);
  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/tenants/${params.tenantId}`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Tenant
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Profiles & Permissions · ${tenant.name}`}
        subtitle="Create and manage reusable access profiles."
        action={<TenantProfileDialog tenantId={tenant.id} />}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profile</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => {
              const enabledPermissions = Object.entries(profile.permissions)
                .filter((entry) => Boolean(entry[1]))
                .map((entry) => entry[0]);
              return (
                <TableRow key={profile.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{profile.name}</p>
                    {profile.description && (
                      <p className="text-xs text-foreground-muted mt-0.5">{profile.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {enabledPermissions.length ? (
                        enabledPermissions.slice(0, 4).map((permission) => (
                          <span
                            key={permission}
                            className="inline-flex rounded-full bg-surface-inset px-2 py-0.5 text-[11px] text-foreground-secondary"
                          >
                            {permission}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-foreground-muted">No explicit permissions</span>
                      )}
                      {enabledPermissions.length > 4 && (
                        <span className="inline-flex rounded-full bg-surface-inset px-2 py-0.5 text-[11px] text-foreground-secondary">
                          +{enabledPermissions.length - 4} more
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(profile.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <TenantProfileDialog tenantId={tenant.id} profile={profile} />
                      <DeleteTenantProfileButton
                        tenantId={tenant.id}
                        profileId={profile.id}
                        profileName={profile.name}
                        disabled={profile.is_system}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {profiles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto text-foreground-muted mb-3" />
            <p className="text-foreground-secondary mb-2">No access profiles found.</p>
            <TenantProfileDialog tenantId={tenant.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

