import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { FilterActions, FilterBar, FilterGroup, FilterRow } from "@/components/ui/filter-bar";
import { getAdminActivity, getTenantSelectOptions } from "@/features/admin/data/admin";
import { Activity } from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";

export default async function AdminActivityPage({
  searchParams
}: {
  searchParams?: { tenantId?: string; action?: string };
}) {
  const tenantId = searchParams?.tenantId ?? "all";
  const action = searchParams?.action ?? "all";

  const [tenantOptions, rows] = await Promise.all([
    getTenantSelectOptions(),
    getAdminActivity({
      tenantId,
      action,
      limit: 200
    })
  ]);

  const actions = Array.from(new Set(rows.map((row) => row.action))).sort();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity Log"
        subtitle="Review recent super-admin and tenant-level actions."
      />

      <FilterBar>
        <form method="get">
          <FilterRow>
            <FilterGroup label="Tenant">
              <select
                name="tenantId"
                defaultValue={tenantId}
                className="flex h-10 rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground-secondary min-w-[220px]"
              >
                <option value="all">All tenants</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup label="Action">
              <select
                name="action"
                defaultValue={action}
                className="flex h-10 rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground-secondary min-w-[220px]"
              >
                <option value="all">All actions</option>
                {actions.map((actionName) => (
                  <option key={actionName} value={actionName}>
                    {actionName.replaceAll("_", " ")}
                  </option>
                ))}
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.created_at)}</TableCell>
                <TableCell>{row.tenant_name ?? row.tenant_id}</TableCell>
                <TableCell>{row.actor_name ?? "System"}</TableCell>
                <TableCell className="capitalize">{row.action.replaceAll("_", " ")}</TableCell>
                <TableCell>
                  <div className="text-xs text-foreground-secondary">
                    <p>{row.entity_type}{row.entity_id ? ` · ${row.entity_id}` : ""}</p>
                    {row.metadata && Object.keys(row.metadata).length > 0 && (
                      <p className="text-foreground-muted mt-0.5 truncate">
                        {JSON.stringify(row.metadata)}
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 mx-auto text-foreground-muted mb-3" />
            <p className="text-foreground-secondary">No activity found for the selected filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

