"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { ManagerPaidToggle } from "./ManagerPaidToggle";
import type { ManagerCommissionResult, ManagerLine } from "../domain/types";

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${className}`}>
      {children}
    </span>
  );
}

function TypePill({ line }: { line: ManagerLine }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        line.source_type === "rental"
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
      }`}
    >
      {line.source_type === "rental" ? "Rental" : "Bonus"}
    </span>
  );
}

function LineAmount({ line }: { line: ManagerLine }) {
  if (line.paid && line.paid.amount !== line.amount) {
    return (
      <Tooltip
        content={`Paid ${formatGBP(line.paid.amount)}. The deal has changed since, and today's figure would be ${formatGBP(line.amount)}.`}
      >
        <span className="inline-flex items-center gap-1" tabIndex={0}>
          {formatGBP(line.paid.amount)}
          <Info className="h-3 w-3 text-amber-600" />
        </span>
      </Tooltip>
    );
  }
  return <>{formatGBP(line.paid?.amount ?? line.amount)}</>;
}

/**
 * A manager's commission for the period, grouped by the agent who closed each
 * deal. Each agent row expands to the individual rentals and bonuses.
 */
export function ManagerCommissionSection({
  result,
  isAdmin,
}: {
  result: ManagerCommissionResult;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { totals, byAgent } = result;

  const toggle = (agentId: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Chip className="bg-emerald-50 text-emerald-700">{formatGBP(totals.earned)} earned</Chip>
        <Chip className="bg-green-50 text-green-700">{formatGBP(totals.paid)} paid</Chip>
        <Chip className="bg-amber-50 text-amber-700">{formatGBP(totals.unpaid)} unpaid</Chip>
        {totals.pending > 0 && (
          <Tooltip content="Deals still awaiting approval. They become payable once approved.">
            <span tabIndex={0}>
              <Chip className="bg-slate-100 text-slate-700">{formatGBP(totals.pending)} awaiting approval</Chip>
            </span>
          </Tooltip>
        )}
      </div>

      {byAgent.length === 0 ? (
        <p className="text-sm text-foreground-muted py-10 text-center">
          No rentals or bonuses from this manager&apos;s agents in this period.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground-muted font-medium">
                <th className="pb-3 pr-2 w-8" aria-label="Expand" />
                <th className="pb-3 pr-4">Agent</th>
                <th className="pb-3 pr-4 text-right">Rentals</th>
                <th className="pb-3 pr-4 text-right">Bonuses</th>
                <th className="pb-3 pr-4 text-right tabular-nums">Earned</th>
                <th className="pb-3 pr-4 text-right tabular-nums">Unpaid</th>
                <th className="pb-3 pl-4 text-right tabular-nums">Awaiting approval</th>
              </tr>
            </thead>
            <tbody>
              {byAgent.map((agent) => {
                const expanded = open.has(agent.agent_id);
                return (
                  <Fragment key={agent.agent_id}>
                    <tr className="border-b border-border/60">
                      <td className="py-3 pr-2">
                        <button
                          type="button"
                          onClick={() => toggle(agent.agent_id)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} ${agent.agent_name}'s deals`}
                          className="inline-flex h-11 w-11 md:h-7 md:w-7 items-center justify-center rounded text-foreground-muted hover:bg-surface-inset hover:text-foreground"
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="py-3 pr-4 font-medium">{agent.agent_name}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-foreground-muted whitespace-nowrap">
                        {agent.rentals} · {formatGBP(agent.rental_base)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-foreground-muted whitespace-nowrap">
                        {agent.bonuses} · {formatGBP(agent.bonus_base)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums font-medium">{formatGBP(agent.earned)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-amber-600">{formatGBP(agent.unpaid)}</td>
                      <td className="py-3 pl-4 text-right tabular-nums text-foreground-muted">
                        {formatGBP(agent.pending)}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-border/60 bg-surface-inset/50">
                        <td />
                        <td colSpan={6} className="py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-foreground-muted">
                                <th className="pb-2 pr-3">Date</th>
                                <th className="pb-2 pr-3">Type</th>
                                <th className="pb-2 pr-3">Code / client</th>
                                <th className="pb-2 pr-3 text-right">
                                  <Tooltip content="Rental net after card fee and VAT (where VAT applies), or the bonus amount.">
                                    <span className="inline-flex items-center gap-1" tabIndex={0}>
                                      Base <Info className="h-3 w-3" />
                                    </span>
                                  </Tooltip>
                                </th>
                                <th className="pb-2 pr-3 text-right">%</th>
                                <th className="pb-2 pr-3 text-right">Manager cut</th>
                                {isAdmin && (
                                  <th className="pb-2 pr-3 text-right">
                                    <Tooltip content="What the agency keeps after the agent's commission and the manager's cut. Red means the agency lost money on this deal.">
                                      <span className="inline-flex items-center gap-1" tabIndex={0}>
                                        Company keeps <Info className="h-3 w-3" />
                                      </span>
                                    </Tooltip>
                                  </th>
                                )}
                                <th className="pb-2 pl-3">Paid</th>
                              </tr>
                            </thead>
                            <tbody>
                              {agent.lines.map((line) => (
                                <tr key={line.key} className="border-t border-border/40">
                                  <td className="py-2 pr-3 whitespace-nowrap text-foreground-muted">
                                    {formatDate(line.date)}
                                  </td>
                                  <td className="py-2 pr-3">
                                    <TypePill line={line} />
                                    {line.state === "void" && (
                                      <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                        {line.source_status === "refunded" ? "Refunded" : "Declined"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-3">
                                    {line.code && <span className="font-medium mr-1.5">{line.code}</span>}
                                    <span className="text-foreground-muted">{line.client_name || "—"}</span>
                                  </td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{formatGBP(line.base)}</td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{line.percent}%</td>
                                  <td className="py-2 pr-3 text-right tabular-nums font-medium">
                                    <LineAmount line={line} />
                                  </td>
                                  {isAdmin && (
                                    <td
                                      className={`py-2 pr-3 text-right tabular-nums ${
                                        (line.company_keeps ?? 0) < 0 ? "text-red-600 font-medium" : "text-foreground-muted"
                                      }`}
                                    >
                                      {line.company_keeps === null ? "—" : formatGBP(line.company_keeps)}
                                    </td>
                                  )}
                                  <td className="py-2 pl-3">
                                    <ManagerPaidToggle line={line} isAdmin={isAdmin} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td />
                <td className="pt-3 pr-4 text-foreground-muted">
                  Total ({byAgent.length} {byAgent.length === 1 ? "agent" : "agents"})
                </td>
                <td className="pt-3 pr-4" />
                <td className="pt-3 pr-4" />
                <td className="pt-3 pr-4 text-right tabular-nums">{formatGBP(totals.earned)}</td>
                <td className="pt-3 pr-4 text-right tabular-nums text-amber-600">{formatGBP(totals.unpaid)}</td>
                <td className="pt-3 pl-4 text-right tabular-nums text-foreground-muted">
                  {formatGBP(totals.pending)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
