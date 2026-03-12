import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { FilterActions, FilterBar, FilterGroup, FilterRow } from "@/components/ui/filter-bar";
import { getTenants } from "@/features/admin/data/admin";
import { CreateTenantDialog } from "@/features/admin/ui/CreateTenantDialog";
import { TenantStatusActionButton } from "@/features/admin/ui/TenantStatusActionButton";
import { Building2 } from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";

export default async function AdminTenantsPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string; page?: string };
}) {
  const q = searchParams?.q ?? "";
  const status = searchParams?.status ?? "all";
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);

  const { tenants, total, totalPages } = await getTenants({
    search: q,
    status,
    page
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tenants"
        subtitle="Create, edit, suspend, and inspect tenant workspaces."
        action={<CreateTenantDialog />}
      />

      <FilterBar>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <FilterRow>
            <FilterGroup label="Search">
              <Input name="q" placeholder="Search name or slug..." defaultValue={q} className="w-72" />
            </FilterGroup>
            <FilterGroup label="Status">
              <select
                name="status"
                defaultValue={status}
                className="flex h-10 rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground-secondary min-w-[150px]"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </FilterGroup>
            <FilterActions>
              <Button type="submit" variant="outline" size="sm">
                Apply
              </Button>
            </FilterActions>
          </FilterRow>
        </form>
      </FilterBar>

      <p className="text-sm text-foreground-secondary">
        Showing <span className="font-medium text-foreground">{tenants.length}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> tenants
      </p>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <Link href={`/admin/tenants/${tenant.id}`} className="font-medium text-foreground hover:text-brand">
                    {tenant.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{tenant.slug}</TableCell>
                <TableCell>
                  <StatusBadge status={tenant.status} size="sm" />
                </TableCell>
                <TableCell>{formatDate(tenant.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/tenants/${tenant.id}`}>View</Link>
                    </Button>
                    <TenantStatusActionButton tenantId={tenant.id} currentStatus={tenant.status} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {tenants.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-10 w-10 mx-auto text-foreground-muted mb-3" />
            <p className="text-foreground-secondary">No tenants match your filters.</p>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-foreground-muted mr-2">Page {page} of {totalPages}</span>
          {page > 1 && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/tenants?q=${encodeURIComponent(q)}&status=${status}&page=${page - 1}`}>Previous</Link>
            </Button>
          )}
          {page < totalPages && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/tenants?q=${encodeURIComponent(q)}&status=${status}&page=${page + 1}`}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

