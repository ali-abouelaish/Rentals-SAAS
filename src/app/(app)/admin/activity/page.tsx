import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
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
import { AUDIT_CATEGORIES, getPlatformAudit } from "@/features/admin/data/audit";
import { AuditLogTable } from "@/features/admin/ui/AuditLogTable";
import { Activity, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";

/**
 * Two logs, one screen.
 *
 * PLATFORM — `platform_audit_log`: what we did, across every agency. No agency
 *            can read this. The default, because it is the one this console is
 *            accountable for.
 * TENANT   — `activity_log`: business events inside each agency, which that
 *            agency also sees in its own feed.
 *
 * They are deliberately separate tables; see
 * supabase/migrations/20260913000002_platform_audit_log.sql.
 */

const SELECT_CLASS =
  "flex h-10 rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground-secondary min-w-[200px]";

const DAY_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" }
];

export default async function AdminActivityPage({
  searchParams
}: {
  searchParams?: {
    scope?: string;
    tenantId?: string;
    action?: string;
    category?: string;
    severity?: string;
    days?: string;
  };
}) {
  const scope = searchParams?.scope === "tenant" ? "tenant" : "platform";
  const tenantId = searchParams?.tenantId ?? "all";
  const action = searchParams?.action ?? "all";
  const category = searchParams?.category ?? "all";
  const severity = searchParams?.severity ?? "all";
  const days = searchParams?.days ?? "30";

  const tenantOptions = await getTenantSelectOptions();

  const platform =
    scope === "platform"
      ? await getPlatformAudit({
          tenantId,
          action,
          category,
          severity,
          days: Number(days)
        })
      : null;

  const tenantRows = scope === "tenant" ? await getAdminActivity({ tenantId, action, limit: 200 }) : [];

  // Only used by the tenant view, which has no distinct-action query of its own.
  const tenantActions = Array.from(new Set(tenantRows.map((row) => row.action))).sort();

  const tabs = [
    { value: "platform", label: "Platform audit" },
    { value: "tenant", label: "Tenant activity" }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity Log"
        subtitle={
          scope === "platform"
            ? "Every super-admin and platform action, across all agencies. Not visible to any agency."
            : "Business events inside each agency — the same records that agency sees in its own activity feed."
        }
      />

      <div className="flex gap-1 rounded-lg bg-surface-inset p-1 w-fit">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/activity?scope=${tab.value}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              scope === tab.value
                ? "bg-surface-card text-foreground shadow-sm"
                : "text-foreground-secondary hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <FilterBar>
        <form method="get">
          <input type="hidden" name="scope" value={scope} />
          <FilterRow>
            <FilterGroup label="Agency">
              <select name="tenantId" defaultValue={tenantId} className={SELECT_CLASS}>
                <option value="all">All agencies</option>
                {scope === "platform" && <option value="">Platform-wide only</option>}
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </FilterGroup>

            {scope === "platform" && (
              <FilterGroup label="Category">
                <select name="category" defaultValue={category} className={SELECT_CLASS}>
                  <option value="all">All categories</option>
                  {AUDIT_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterGroup>
            )}

            <FilterGroup label="Action">
              <select name="action" defaultValue={action} className={SELECT_CLASS}>
                <option value="all">All actions</option>
                {(scope === "platform" ? platform?.actions ?? [] : tenantActions).map(
                  (actionName) => (
                    <option key={actionName} value={actionName}>
                      {actionName.replaceAll("_", " ")}
                    </option>
                  )
                )}
              </select>
            </FilterGroup>

            {scope === "platform" && (
              <>
                <FilterGroup label="Severity">
                  <select name="severity" defaultValue={severity} className={SELECT_CLASS}>
                    <option value="all">Any severity</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </FilterGroup>

                <FilterGroup label="Period">
                  <select name="days" defaultValue={days} className={SELECT_CLASS}>
                    {DAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FilterGroup>
              </>
            )}

            <FilterActions>
              <Button type="submit" variant="outline" size="sm">
                Apply
              </Button>
            </FilterActions>
          </FilterRow>
        </form>
      </FilterBar>

      {scope === "platform" ? (
        platform?.unavailable ? (
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    The platform audit log could not be read
                  </p>
                  <p className="text-foreground-secondary mt-1">
                    Apply migration{" "}
                    <code>20260913000002_platform_audit_log.sql</code>, then reload. Until
                    then, super-admin actions are not being recorded anywhere.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <AuditLogTable rows={platform?.rows ?? []} />
        )
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-foreground-secondary">
                        {formatDate(row.created_at)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.tenant_name ?? row.tenant_id}
                      </TableCell>
                      <TableCell className="text-xs">{row.actor_name ?? "System"}</TableCell>
                      <TableCell className="text-xs capitalize">
                        {row.action.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell>
                        <div className="text-[11px] text-foreground-secondary">
                          <p>
                            {row.entity_type}
                            {row.entity_id ? ` · ${row.entity_id}` : ""}
                          </p>
                          {row.metadata && Object.keys(row.metadata).length > 0 && (
                            <p className="text-foreground-muted mt-0.5 truncate max-w-md">
                              {JSON.stringify(row.metadata)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {tenantRows.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="h-10 w-10 mx-auto text-foreground-muted mb-3" aria-hidden />
                <p className="text-foreground-secondary">
                  No tenant activity found for the selected filters.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
