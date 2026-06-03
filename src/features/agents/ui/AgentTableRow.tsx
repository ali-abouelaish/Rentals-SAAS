"use client";

import { useRouter } from "next/navigation";
import { TableRow, TableCell } from "@/components/ui/table";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { formatDate, formatGBP } from "@/lib/utils/formatters";

export type AgentTableRowData = {
  user_id: string;
  display_name: string;
  role: string;
  commission_percent: number | null;
  avatar_url: string | null;
  rank: number;
  rentals: number;
  earnings: number;
  last_activity: string | null;
  is_disabled: boolean;
};

function formatRoleLabel(role: string): string {
  const r = role.toLowerCase();
  if (r === "agent_and_marketing") return "Agent";
  if (r === "marketing_only") return "Marketing only";
  if (r === "super_admin") return "Admin";
  if (!r) return "Unknown";
  return r.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function AgentTableRow({ row }: { row: AgentTableRowData }) {
  const router = useRouter();
  const href = `/agents/${row.user_id}`;

  return (
    <TableRow
      className="group cursor-pointer hover:bg-surface-inset/70 transition-colors"
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <TableCell className="tabular-nums text-foreground-muted">
        {row.rank || "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0">
            <AvatarCircle name={row.display_name} url={row.avatar_url} />
          </div>
          <span
            className={
              row.is_disabled
                ? "font-medium text-foreground-muted line-through group-hover:text-brand"
                : "font-medium text-foreground group-hover:text-brand"
            }
          >
            {row.display_name}
          </span>
          {row.is_disabled && (
            <span className="px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
              Disabled
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="px-2 py-1 rounded-md bg-surface-inset text-foreground-secondary text-xs font-medium capitalize">
          {formatRoleLabel(row.role)}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.rentals}</TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatGBP(row.earnings)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-foreground-muted">
        {row.commission_percent != null ? `${row.commission_percent}%` : "—"}
      </TableCell>
      <TableCell className="text-right text-foreground-muted text-sm">
        {row.last_activity ? formatDate(row.last_activity) : "—"}
      </TableCell>
    </TableRow>
  );
}
