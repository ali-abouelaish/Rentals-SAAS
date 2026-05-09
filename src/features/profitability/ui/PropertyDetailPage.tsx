"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import {
  ArrowLeft,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Wrench,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { COST_TYPE_LABELS, COST_MODE_LABELS } from "../domain/types";
import type { PropertyProfitability, PropertyCost, PropertyMonthPoint } from "../domain/types";
import { CostModal } from "./CostModal";
import { PropertyTrendChart } from "./PropertyTrendChart";
import { deletePropertyCost, upsertPropertyTarget } from "../actions";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function fmt(pence: number, signed = false): string {
  const pounds = Math.abs(pence) / 100;
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pounds);
  if (signed) return (pence < 0 ? "-" : "+") + formatted;
  return formatted;
}

function PortfolioBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface-inset p-4">
      <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">{label}</p>
      <p
        className={cn(
          "text-xl font-bold mt-1.5 tabular-nums",
          positive === true
            ? "text-emerald-600"
            : positive === false
            ? "text-red-600"
            : "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-foreground-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────

interface PropertyDetailPageProps {
  property: PropertyProfitability;
  trend: PropertyMonthPoint[];
}

export function PropertyDetailPage({ property, trend }: PropertyDetailPageProps) {
  const [showCostModal, setShowCostModal] = useState(false);
  const [editingCost, setEditingCost] = useState<PropertyCost | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [furnitureView, setFurnitureView] = useState<"cash" | "amortised">("amortised");
  const [costs, setCosts] = useState<PropertyCost[]>(property.costs);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>(
    property.target_profit !== null ? String(Math.round(property.target_profit / 100)) : ""
  );
  const [savingTarget, setSavingTarget] = useState(false);

  async function handleSaveTarget() {
    const pcm = Number(targetInput);
    if (!Number.isFinite(pcm) || pcm < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSavingTarget(true);
    try {
      const result = await upsertPropertyTarget({
        property_id: property.property_id,
        target_profit_pcm: Math.round(pcm),
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Target saved");
        setEditingTarget(false);
        window.location.reload();
      }
    } finally {
      setSavingTarget(false);
    }
  }

  const netProfit = property.net_profit;
  const isProfit = netProfit >= 0;
  const aboveTarget =
    property.vs_target !== null ? property.vs_target >= 0 : null;

  // Separate furniture costs for display toggle
  const furnitureCosts = costs.filter((c) => c.cost_type === "furniture" && c.cost_mode === "amortised");
  const nonFurnitureCosts = costs.filter((c) => !(c.cost_type === "furniture" && c.cost_mode === "amortised"));

  function amortisedMonthlyDisplay(cost: PropertyCost): number {
    if (!cost.amortise_months) return 0;
    return Math.round(cost.amount / cost.amortise_months);
  }

  function displayedCosts(): PropertyCost[] {
    if (furnitureView === "amortised") return costs;
    // Cash view: show furniture at full cost
    return costs;
  }

  async function handleDelete(cost: PropertyCost) {
    if (!confirm(`Delete "${COST_TYPE_LABELS[cost.cost_type]}"? This cannot be undone.`)) return;
    setDeletingId(cost.id);
    try {
      const result = await deletePropertyCost(cost.id, property.property_id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Cost deleted");
        setCosts((prev) => prev.filter((c) => c.id !== cost.id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <Link
          href="/profitability"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft size={15} />
          Back to Profitability
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/properties/${property.property_id}`}
              className="text-2xl font-bold tracking-tight font-heading text-foreground hover:text-brand transition-colors"
            >
              {property.property_name}
            </Link>
            <a
              href={`/properties/${property.property_id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open property view in new tab"
              className="inline-flex items-center justify-center p-1 rounded-md text-foreground-muted hover:text-brand hover:bg-surface-inset transition-colors"
            >
              <ExternalLink size={16} />
            </a>
            <PortfolioBadge
              name={property.portfolio_name}
              color={property.portfolio_color}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground-secondary">
            <span>
              {property.occupied_units}/{property.total_units} units occupied
            </span>
            <ChevronRight size={14} className="text-foreground-muted" />
            <span>
              {new Date().toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Total Income" value={fmt(property.total_income)} />
        <SummaryCard label="Total Costs" value={fmt(property.total_costs)} />
        <SummaryCard
          label="Vacancy Loss"
          value={
            property.vacancy_loss + property.total_pre_let_loss > 0
              ? `-${fmt(property.vacancy_loss + property.total_pre_let_loss)}`
              : "£0"
          }
          positive={property.vacancy_loss + property.total_pre_let_loss === 0}
        />
        <SummaryCard
          label="Net Profit"
          value={fmt(netProfit, true)}
          positive={isProfit}
        />
        <div className="rounded-xl bg-surface-inset p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">vs Target</p>
            {!editingTarget && (
              <button
                type="button"
                onClick={() => setEditingTarget(true)}
                className="p-1 rounded hover:bg-surface-card text-foreground-muted hover:text-foreground transition-colors"
                title={property.target_profit !== null ? "Edit target" : "Set target"}
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
          {editingTarget ? (
            <div className="mt-1.5 space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm text-foreground-muted">£</span>
                <input
                  type="number"
                  min={0}
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="Target /mo"
                  className="w-full bg-surface-card border border-border rounded-lg px-2 py-1 text-sm font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-brand"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveTarget}
                  disabled={savingTarget}
                  className="flex-1 rounded-md bg-brand text-brand-fg px-2 py-1 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {savingTarget ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTarget(false);
                    setTargetInput(
                      property.target_profit !== null
                        ? String(Math.round(property.target_profit / 100))
                        : ""
                    );
                  }}
                  disabled={savingTarget}
                  className="rounded-md border border-border bg-surface-card px-2 py-1 text-xs font-medium text-foreground-secondary hover:bg-surface-inset transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p
                className={cn(
                  "text-xl font-bold mt-1.5 tabular-nums",
                  aboveTarget === true
                    ? "text-emerald-600"
                    : aboveTarget === false
                    ? "text-red-600"
                    : "text-foreground"
                )}
              >
                {property.vs_target !== null ? fmt(property.vs_target, true) : "No target"}
              </p>
              {property.target_profit !== null && (
                <p className="text-xs text-foreground-muted mt-0.5">
                  Target: {fmt(property.target_profit)}/mo
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Trend indicator */}
      {property.trend && (
        <div className="flex items-center gap-2">
          {property.trend === "up" && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <TrendingUp size={16} /> Up from last month
            </span>
          )}
          {property.trend === "down" && (
            <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
              <TrendingDown size={16} /> Down from last month
              {property.last_month_net_profit !== null && (
                <span className="text-foreground-muted">
                  (was {fmt(property.last_month_net_profit)})
                </span>
              )}
            </span>
          )}
          {property.trend === "flat" && (
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground-muted">
              <Minus size={16} /> Flat vs last month
            </span>
          )}
        </div>
      )}

      {/* Trend Chart */}
      {trend.length > 0 && <PropertyTrendChart data={trend} />}

      {/* Income Breakdown */}
      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Income Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider border-b border-border">
                <th className="text-left pb-3">Unit</th>
                <th className="text-left pb-3">Tenant</th>
                <th className="text-right pb-3">Rent PCM</th>
                <th
                  className="text-right pb-3 hidden sm:table-cell"
                  title="Total empty days = Pre-let Gap (since owner-landlord contract start) + Re-let Gap (currently between tenants). Hover the number for the exact periods."
                >
                  Vacant days
                </th>
                <th className="text-right pb-3 hidden md:table-cell">Vacancy Loss</th>
                <th className="text-right pb-3">Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {property.unit_breakdown.map((unit) => (
                <tr key={unit.unit_id} className="hover:bg-surface-inset transition-colors">
                  <td className="py-3 pr-4 font-medium text-foreground">{unit.unit_label}</td>
                  <td className="py-3 pr-4">
                    {unit.tenant_name ? (
                      <span className="text-foreground">{unit.tenant_name}</span>
                    ) : (
                      <span className="text-amber-600 font-medium">Vacant</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {unit.rent_pcm > 0 ? fmt(unit.rent_pcm) : <span className="text-foreground-muted">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-right hidden sm:table-cell tabular-nums">
                    {(() => {
                      const preLet = unit.pre_let_days ?? 0;
                      const totalDays = preLet + unit.days_vacant;
                      if (totalDays === 0) return <span className="text-foreground-muted">—</span>;
                      const tooltipParts: string[] = [];
                      if (preLet > 0 && unit.pre_let_period_start && unit.pre_let_period_end) {
                        tooltipParts.push(
                          `Pre-let: ${unit.pre_let_period_start} → ${unit.pre_let_period_end} (${preLet}d)`
                        );
                      }
                      if (unit.days_vacant > 0 && unit.vacant_since) {
                        tooltipParts.push(
                          `Currently vacant: ${unit.vacant_since} → today (${unit.days_vacant}d)`
                        );
                      }
                      return (
                        <span
                          className="text-amber-600 cursor-help underline decoration-dotted underline-offset-2"
                          title={tooltipParts.join("\n")}
                        >
                          {totalDays}d
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 pr-4 text-right hidden md:table-cell tabular-nums">
                    {(() => {
                      const totalLoss = unit.pre_let_loss + unit.vacancy_loss;
                      if (totalLoss === 0) return <span className="text-foreground-muted">—</span>;
                      return <span className="text-red-600">-{fmt(totalLoss)}</span>;
                    })()}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    <span
                      className={cn(
                        "font-semibold",
                        unit.net_contribution >= 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {unit.net_contribution >= 0 ? "" : "-"}
                      {fmt(Math.abs(unit.net_contribution))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border">
              <tr className="font-semibold">
                <td colSpan={2} className="pt-3 text-foreground">Total</td>
                <td className="pt-3 text-right tabular-nums">{fmt(property.total_income)}</td>
                <td className="pt-3 text-right hidden sm:table-cell tabular-nums">
                  {(() => {
                    const totalDays =
                      property.total_pre_let_days +
                      property.unit_breakdown.reduce((s, u) => s + u.days_vacant, 0);
                    if (totalDays === 0) return <span className="text-foreground-muted font-normal">—</span>;
                    return <span className="text-amber-600">{totalDays}d</span>;
                  })()}
                </td>
                <td className="pt-3 text-right hidden md:table-cell tabular-nums">
                  {(() => {
                    const totalLoss = property.total_pre_let_loss + property.vacancy_loss;
                    if (totalLoss === 0) return <span className="text-foreground-muted font-normal">—</span>;
                    return <span className="text-red-600">-{fmt(totalLoss)}</span>;
                  })()}
                </td>
                <td className="pt-3 text-right tabular-nums">
                  <span className="text-emerald-600">
                    {fmt(property.total_income)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Costs Breakdown */}
      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-foreground">Costs Breakdown</h2>
          <div className="flex items-center gap-2">
            {/* Furniture view toggle */}
            {furnitureCosts.length > 0 && (
              <button
                onClick={() => setFurnitureView((v) => (v === "amortised" ? "cash" : "amortised"))}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-secondary hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5"
              >
                {furnitureView === "amortised" ? (
                  <ToggleRight size={14} className="text-brand" />
                ) : (
                  <ToggleLeft size={14} />
                )}
                Furniture: {furnitureView === "amortised" ? "Amortised" : "Cash basis"}
              </button>
            )}
            <button
              onClick={() => { setEditingCost(null); setShowCostModal(true); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 transition-opacity"
            >
              <Plus size={15} />
              Add Cost
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider border-b border-border">
                <th className="text-left pb-3">Type</th>
                <th className="text-left pb-3 hidden md:table-cell">Label</th>
                <th className="text-right pb-3">Amount</th>
                <th className="text-left pb-3 hidden sm:table-cell pl-4">Mode</th>
                <th className="text-left pb-3 hidden lg:table-cell">Date</th>
                <th className="text-left pb-3 hidden xl:table-cell">Unit</th>
                <th className="text-right pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {property.owner_rent_monthly > 0 && (
                <tr className="bg-surface-inset/40">
                  <td className="py-3 pr-4">
                    <span className="font-medium text-foreground">
                      {COST_TYPE_LABELS.owner_rent}
                    </span>
                  </td>
                  <td className="py-3 pr-4 hidden md:table-cell text-foreground-secondary">
                    {property.owner_landlord_name
                      ? `Paid to ${property.owner_landlord_name}`
                      : "Rent paid to owner landlord"}
                    {property.owner_payment_schedule &&
                    property.owner_payment_schedule !== "monthly"
                      ? ` (${property.owner_payment_schedule}, monthly equivalent)`
                      : ""}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-medium">
                    {fmt(property.owner_rent_monthly)}
                  </td>
                  <td className="py-3 pr-4 hidden sm:table-cell pl-4">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-700">
                      {COST_MODE_LABELS.recurring}
                    </span>
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell text-foreground-muted text-xs italic">
                    From property contract
                  </td>
                  <td className="py-3 pr-4 hidden xl:table-cell" />
                  <td className="py-3" />
                </tr>
              )}
              {displayedCosts().map((cost) => {
                const isAmortisedFurniture =
                  cost.cost_type === "furniture" && cost.cost_mode === "amortised";
                const displayAmount =
                  furnitureView === "amortised" && isAmortisedFurniture
                    ? amortisedMonthlyDisplay(cost)
                    : cost.amount;

                return (
                  <tr key={cost.id} className="hover:bg-surface-inset transition-colors group">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        {cost.source === "maintenance" && cost.source_id && (
                          <a
                            href={`/maintenance?job=${cost.source_id}`}
                            title="View maintenance job"
                            onClick={(e) => e.stopPropagation()}
                            className="text-orange-500 hover:text-orange-700 transition-colors shrink-0"
                          >
                            <Wrench size={13} />
                          </a>
                        )}
                        <span className="font-medium text-foreground">
                          {COST_TYPE_LABELS[cost.cost_type]}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell text-foreground-secondary">
                      {isAmortisedFurniture && furnitureView === "amortised"
                        ? `${cost.cost_label ?? ""} (÷${cost.amortise_months} mo)`
                        : cost.cost_label ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums font-medium">
                      {fmt(displayAmount)}
                      {isAmortisedFurniture && furnitureView === "amortised" && (
                        <span className="text-[11px] text-foreground-muted block">/mo</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell pl-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                          cost.cost_mode === "recurring"
                            ? "bg-blue-50 text-blue-700"
                            : cost.cost_mode === "amortised"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {COST_MODE_LABELS[cost.cost_mode]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 hidden lg:table-cell text-foreground-secondary text-xs">
                      {new Date(cost.date_incurred).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 pr-4 hidden xl:table-cell text-foreground-secondary text-xs">
                      {cost.unit_id ?? "Property-wide"}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingCost(cost); setShowCostModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-surface-card text-foreground-muted hover:text-foreground transition-colors"
                          title="Edit cost"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(cost)}
                          disabled={deletingId === cost.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-foreground-muted hover:text-red-600 transition-colors"
                          title="Delete cost"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-border">
              <tr className="font-semibold">
                <td colSpan={2} className="pt-3 text-foreground">Total Costs</td>
                <td className="pt-3 text-right tabular-nums text-red-600">
                  {fmt(property.total_costs)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>

          {costs.length === 0 && (
            <div className="py-12 text-center text-sm text-foreground-muted">
              No costs logged yet.{" "}
              <button
                onClick={() => setShowCostModal(true)}
                className="text-brand font-medium hover:underline"
              >
                Add the first cost
              </button>
            </div>
          )}
        </div>

        {/* Furniture amortisation note */}
        {furnitureCosts.length > 0 && furnitureView === "amortised" && (
          <div className="mt-4 p-3 rounded-xl bg-violet-50 border border-violet-100">
            <p className="text-xs text-violet-700">
              <strong>Amortised view active.</strong> Furniture costs are shown as monthly figures.
              Toggle to &ldquo;Cash basis&rdquo; to see the full purchase cost in the month it was logged.
            </p>
          </div>
        )}
      </div>

      {/* Net Profit */}
      <div
        className="rounded-bento bg-surface-card shadow-bento p-6"
        title="Net Profit = Total Income − Total Costs − Vacancy Loss (Pre-let Gap + Re-let Gap)"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Net Profit</h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Income − Costs − Vacancy Loss
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm tabular-nums">
            <span className="text-foreground-muted">
              Income <span className="font-medium text-foreground">{fmt(property.total_income)}</span>
            </span>
            <span className="text-foreground-muted">
              Costs <span className="font-medium text-red-600">-{fmt(property.total_costs)}</span>
            </span>
            <span className="text-foreground-muted">
              Vacancy Loss{" "}
              <span className="font-medium text-red-600">
                {property.vacancy_loss + property.total_pre_let_loss > 0
                  ? `-${fmt(property.vacancy_loss + property.total_pre_let_loss)}`
                  : fmt(0)}
              </span>
            </span>
            <span
              className={cn(
                "text-2xl font-bold",
                netProfit >= 0 ? "text-emerald-600" : "text-red-600"
              )}
            >
              {fmt(netProfit, true)}
            </span>
          </div>
        </div>
      </div>

      {/* Cost Modal */}
      {showCostModal && (
        <CostModal
          propertyId={property.property_id}
          editingCost={editingCost}
          onClose={() => { setShowCostModal(false); setEditingCost(null); }}
          onSuccess={() => {
            // Optimistically handled; router.refresh() would reload server data
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
