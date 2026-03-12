import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getTenantAccessProfiles, getTenantDetails, getTenantUsers } from "@/features/admin/data/admin";
import { TenantUserActions } from "@/features/admin/ui/TenantUserActions";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/formatters";

export default async function AdminTenantUsersPage({
  params
}: {
  params: { tenantId: string };
}) {
  const [tenant, users, profiles] = await Promise.all([
    getTenantDetails(params.tenantId),
    getTenantUsers(params.tenantId),
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
        title={`Tenant Users · ${tenant.name}`}
        subtitle="Assign roles, profiles, and activation status."
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{user.display_name ?? "Unnamed user"}</p>
                  <p className="text-xs text-foreground-muted capitalize">
                    {(user.role ?? "agent").replaceAll("_", " ")}
                  </p>
                </TableCell>
                <TableCell className="text-xs">{user.email ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={user.is_active ? "active" : "inactive"} size="sm" />
                </TableCell>
                <TableCell>{formatDate(user.created_at)}</TableCell>
                <TableCell className="text-right">
                  <TenantUserActions tenantId={tenant.id} user={user} profiles={profiles} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {users.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto text-foreground-muted mb-3" />
            <p className="text-foreground-secondary">No users found for this tenant.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

