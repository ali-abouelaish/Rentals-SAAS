import Link from "next/link";
import { Info, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { formatGBP } from "@/lib/utils/formatters";
import type { ManagerOverviewRow } from "../domain/types";

/** Admin summary on /earnings: what each manager earned in the period. */
export function ManagersOverviewCard({ rows }: { rows: ManagerOverviewRow[] }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + r.earned, 0);
  const unpaid = rows.reduce((sum, r) => sum + r.unpaid, 0);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-brand" />
            <h3 className="text-base font-semibold text-foreground">Manager commission</h3>
            <Tooltip content="Paid from the agency's share on top of agent commission, so it reduces what the agency keeps. Open a manager to see it broken down by agent.">
              <button
                type="button"
                aria-label="About manager commission"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-foreground-muted hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
          <p className="text-sm text-foreground-muted">
            {formatGBP(total)} earned · <span className="text-amber-600">{formatGBP(unpaid)} unpaid</span>
          </p>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground-muted font-medium">
                <th className="pb-3 pr-4">Manager</th>
                <th className="pb-3 pr-4 text-right">Agents</th>
                <th className="pb-3 pr-4 text-right tabular-nums">Earned</th>
                <th className="pb-3 pr-4 text-right tabular-nums">Paid</th>
                <th className="pb-3 pr-4 text-right tabular-nums">Unpaid</th>
                <th className="pb-3 pl-4 text-right tabular-nums">Awaiting approval</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.manager_id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/earnings/${r.manager_id}#manager-commission`}
                      className="font-medium text-foreground-link hover:underline"
                    >
                      {r.manager_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-foreground-muted">{r.agent_count}</td>
                  <td className="py-3 pr-4 text-right tabular-nums font-medium">{formatGBP(r.earned)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums text-foreground-muted">{formatGBP(r.paid)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums text-amber-600">{formatGBP(r.unpaid)}</td>
                  <td className="py-3 pl-4 text-right tabular-nums text-foreground-muted">{formatGBP(r.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
