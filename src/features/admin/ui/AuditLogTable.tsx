import Link from "next/link";
import { ShieldAlert, AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import type { PlatformAuditRow } from "../data/audit";

const CATEGORY_STYLE: Record<string, string> = {
  tenant: "bg-blue-100 text-blue-800",
  billing: "bg-emerald-100 text-emerald-800",
  access: "bg-indigo-100 text-indigo-800",
  integration: "bg-purple-100 text-purple-800",
  system: "bg-neutral-200 text-neutral-700",
  security: "bg-red-100 text-red-800"
};

function timestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Render a before/after pair as "field: old → new".
 *
 * The whole reason the audit table stores a diff rather than two whole rows: the
 * change is legible at a glance instead of requiring the reader to compare two
 * JSON blobs by eye.
 */
function ChangeList({
  before,
  after
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!after) return null;

  const format = (value: unknown): string => {
    if (value === null || value === undefined) return "not set";
    if (typeof value === "boolean") return value ? "on" : "off";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const keys = Object.keys(after);
  if (keys.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {keys.map((key) => (
        <p key={key} className="text-[11px] text-foreground-muted">
          <span className="font-medium">{key.replaceAll("_", " ")}</span>:{" "}
          {before ? (
            <>
              <span className="line-through">{format(before[key])}</span>
              {" → "}
            </>
          ) : null}
          <span className="text-foreground-secondary">{format(after[key])}</span>
        </p>
      ))}
    </div>
  );
}

export function AuditLogTable({ rows }: { rows: PlatformAuditRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldAlert className="h-10 w-10 mx-auto text-foreground-muted mb-3" aria-hidden />
          <p className="text-foreground-secondary">
            No platform activity for the selected filters.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Agency</TableHead>
              <TableHead>What happened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs text-foreground-secondary">
                  {timestamp(row.created_at)}
                </TableCell>

                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                      CATEGORY_STYLE[row.category] ?? CATEGORY_STYLE.system
                    )}
                  >
                    {row.category}
                  </span>
                </TableCell>

                <TableCell className="text-xs">
                  {row.actor_email || row.actor_name ? (
                    <Tooltip content={row.actor_email ?? "No email recorded"}>
                      <span className="text-foreground-secondary cursor-help">
                        {row.actor_name ?? row.actor_email}
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip content="Performed by the platform itself — a scheduled job or a webhook, with no human actor.">
                      <span className="text-foreground-muted cursor-help">System</span>
                    </Tooltip>
                  )}
                </TableCell>

                <TableCell className="text-xs">
                  {row.tenant_id ? (
                    <Link
                      href={`/admin/tenants/${row.tenant_id}`}
                      className="text-foreground-secondary hover:text-foreground hover:underline"
                    >
                      {row.tenant_name ?? row.tenant_id}
                    </Link>
                  ) : (
                    <Tooltip content="Platform-wide — not specific to any one agency.">
                      <span className="text-foreground-muted cursor-help">Platform</span>
                    </Tooltip>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-start gap-1.5">
                    {row.severity !== "info" && (
                      <AlertTriangle
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 mt-0.5",
                          row.severity === "error" ? "text-red-600" : "text-amber-600"
                        )}
                        aria-label={row.severity}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-foreground">{row.summary}</p>
                      <p className="text-[11px] text-foreground-muted mt-0.5">
                        <code>{row.action}</code>
                        {row.entity_type ? ` · ${row.entity_type}` : ""}
                        {row.entity_id ? ` · ${row.entity_id}` : ""}
                      </p>
                      <ChangeList before={row.before} after={row.after} />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
