"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertTriangle,
  Info,
  Sparkles,
  Building2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Evaluation, RiskFlag } from "../domain/types";
import { BreakEvenTimeline } from "./BreakEvenTimeline";
import { LinkPropertyModal } from "./LinkPropertyModal";
import { updateEvaluationStatus, saveAIRecommendations, updateOutcomeNotes } from "../actions/evaluations";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const fmt = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  hmo: "HMO",
  studio: "Studio",
  whole_flat: "Whole Flat",
};

const STATUS_CONFIG = {
  considering: {
    label: "Considering",
    color: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    icon: Clock,
  },
  taken_on: {
    label: "Taken On",
    color: "bg-green-500/10 text-green-400 border border-green-500/20",
    icon: CheckCircle2,
  },
  passed: {
    label: "Passed",
    color: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
    icon: XCircle,
  },
} as const;

// ──────────────────────────────────────────────────────────

type Tab = "summary" | "inputs" | "ai" | "predicted_actual";

interface Property {
  id: string;
  name: string;
  address_line_1: string;
  area: string | null;
  property_type: string;
  portfolio?: { name: string; color: string } | null;
}

interface EvaluationDetailPageProps {
  evaluation: Evaluation;
  properties: Property[];
}

export function EvaluationDetailPage({
  evaluation: initial,
  properties,
}: EvaluationDetailPageProps) {
  const [ev, setEv] = useState(initial);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [statusPending, startStatusTransition] = useTransition();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(ev.actual_vs_predicted_notes ?? "");
  const [notesPending, startNotesPending] = useTransition();

  const st = STATUS_CONFIG[ev.status];
  const StIcon = st.icon;

  const hasProfitData =
    ev.status === "taken_on" && ev.linked_property_id != null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "inputs", label: "Inputs" },
    { key: "ai", label: "AI Analysis" },
    ...(hasProfitData
      ? [{ key: "predicted_actual" as Tab, label: "Predicted vs Actual" }]
      : []),
  ];

  // ── Status change ─────────────────────────────────────
  const handleStatusChange = (newStatus: string) => {
    if (newStatus === ev.status) return;
    if (newStatus === "taken_on") {
      setShowLinkModal(true);
      return;
    }
    startStatusTransition(async () => {
      try {
        await updateEvaluationStatus(ev.id, newStatus as "considering" | "passed");
        setEv((e) => ({ ...e, status: newStatus as typeof ev.status }));
        toast.success("Status updated.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status.");
      }
    });
  };

  // ── Refresh AI ────────────────────────────────────────
  const refreshAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/acquisition-insights/ai-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationId: ev.id,
          address: ev.address,
          detected_area: ev.detected_area,
          property_type: ev.property_type,
          total_rooms: ev.total_rooms,
          rooms: ev.rooms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI request failed");

      await saveAIRecommendations(ev.id, {
        ai_recommended_rents: data.recommended_rents,
        ai_recommended_occupancy: data.recommended_occupancy,
        ai_reasoning: data.occupancy_reasoning,
        ai_comparable_properties: data.comparable_properties_used,
        ai_risk_flags: data.risk_flags,
      });

      setEv((e) => ({
        ...e,
        ai_recommended_rents: data.recommended_rents,
        ai_recommended_occupancy: data.recommended_occupancy,
        ai_reasoning: data.occupancy_reasoning,
        ai_comparable_properties: data.comparable_properties_used,
        ai_risk_flags: data.risk_flags,
        ai_generated_at: new Date().toISOString(),
      }));

      toast.success("AI analysis refreshed.");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  };

  // ── Save notes ────────────────────────────────────────
  const saveNotes = () => {
    startNotesPending(async () => {
      try {
        await updateOutcomeNotes(ev.id, notesValue);
        setEv((e) => ({ ...e, actual_vs_predicted_notes: notesValue }));
        setEditingNotes(false);
        toast.success("Notes saved.");
      } catch {
        toast.error("Failed to save notes.");
      }
    });
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Link modal */}
      {showLinkModal && (
        <LinkPropertyModal
          evaluationId={ev.id}
          properties={properties}
          onClose={() => setShowLinkModal(false)}
        />
      )}

      {/* Back */}
      <Link
        href="/acquisition-insights"
        className="inline-flex items-center gap-1.5 text-[13px] text-foreground-secondary hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Evaluations
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-surface-card p-5">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-foreground">{ev.address}</h1>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-foreground-secondary">
              <span>{ev.detected_area}</span>
              <span>·</span>
              <span>{PROPERTY_TYPE_LABELS[ev.property_type]}</span>
              <span>·</span>
              <span>{ev.total_rooms} rooms</span>
              {ev.portfolio && (
                <>
                  <span>·</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: ev.portfolio.color + "22",
                      color: ev.portfolio.color,
                    }}
                  >
                    {ev.portfolio.name}
                  </span>
                </>
              )}
            </div>
            <p className="text-[12px] text-foreground-secondary">
              Created{" "}
              {new Date(ev.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status dropdown */}
            <div className="relative">
              <select
                value={ev.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusPending}
                className={cn(
                  "h-9 rounded-full border px-3 pr-8 text-[12px] font-semibold cursor-pointer focus:outline-none appearance-none",
                  st.color
                )}
              >
                <option value="considering">Considering</option>
                <option value="taken_on">Taken On</option>
                <option value="passed">Passed</option>
              </select>
              <StIcon
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
            </div>

            {ev.linked_property && (
              <Link
                href={`/properties?highlight=${ev.linked_property.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised border border-border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-border transition-colors"
              >
                <ExternalLink size={12} />
                {ev.linked_property.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-brand text-brand"
                : "border-transparent text-foreground-secondary hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Summary Tab ── */}
      {activeTab === "summary" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Monthly Income" value={fmt(ev.projected_monthly_income)} />
            <SummaryCard label="Monthly Costs" value={fmt(ev.total_monthly_costs)} />
            <SummaryCard
              label="Net Profit / Mo"
              value={fmt(ev.monthly_net_profit)}
              highlight={ev.monthly_net_profit > 0 ? "green" : "red"}
            />
            <SummaryCard label="Setup Cost" value={fmt(ev.total_setup_cost)} />
          </div>

          <BreakEvenTimeline
            totalSetupCost={ev.total_setup_cost}
            monthlyNetProfit={ev.monthly_net_profit}
            breakEvenMonths={ev.break_even_months}
            breakEvenDate={ev.break_even_date}
            annualRoi={ev.annual_roi_percentage}
            createdAt={ev.created_at}
          />
        </div>
      )}

      {/* ── Inputs Tab ── */}
      {activeTab === "inputs" && (
        <div className="space-y-5">
          {/* Property Info */}
          <Section title="Property Details">
            <InfoRow label="Address" value={ev.address} />
            <InfoRow label="Postcode" value={ev.postcode} />
            <InfoRow label="Area" value={ev.detected_area} />
            <InfoRow label="Type" value={PROPERTY_TYPE_LABELS[ev.property_type]} />
            <InfoRow label="Rooms" value={String(ev.total_rooms)} />
            <InfoRow label="Furnished" value={ev.furnished ? "Yes" : "No"} />
          </Section>

          {/* Setup Costs */}
          <Section title="Setup Costs">
            {!ev.furnished && ev.furniture_cost != null && (
              <InfoRow label="Furniture" value={fmt(ev.furniture_cost)} />
            )}
            {ev.refurbishment_cost != null && (
              <InfoRow label="Refurbishment" value={fmt(ev.refurbishment_cost)} />
            )}
            {ev.upfront_fees != null && (
              <InfoRow label="Upfront Fees" value={fmt(ev.upfront_fees)} />
            )}
            {ev.agency_fees != null && (
              <InfoRow label="Agency Fees" value={fmt(ev.agency_fees)} />
            )}
            {ev.other_setup_costs != null && (
              <InfoRow
                label={ev.other_setup_costs_label ?? "Other"}
                value={fmt(ev.other_setup_costs)}
              />
            )}
            <InfoRow label="Total Setup Cost" value={fmt(ev.total_setup_cost)} bold />
          </Section>

          {/* Monthly Costs */}
          <Section title="Monthly Costs">
            <InfoRow label="Rent to Landlord" value={fmt(ev.rent_to_landlord_pcm)} />
            {ev.bills_pcm != null && <InfoRow label="Bills" value={fmt(ev.bills_pcm)} />}
            {ev.council_tax_pcm != null && <InfoRow label="Council Tax" value={fmt(ev.council_tax_pcm)} />}
            {ev.cleaning_pcm != null && <InfoRow label="Cleaning" value={fmt(ev.cleaning_pcm)} />}
            {ev.insurance_pcm != null && <InfoRow label="Insurance" value={fmt(ev.insurance_pcm)} />}
            {ev.other_costs_pcm != null && (
              <InfoRow label={ev.other_costs_label ?? "Other"} value={fmt(ev.other_costs_pcm)} />
            )}
            <InfoRow label="Total Monthly Costs" value={fmt(ev.total_monthly_costs)} bold />
          </Section>

          {/* Room Config */}
          <Section title="Room Configuration">
            <div className="space-y-2">
              {ev.rooms.map((r) => (
                <div
                  key={r.room_number}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <span className="text-[13px] font-medium text-foreground capitalize">
                      Room {r.room_number} · {r.room_type}
                    </span>
                    {r.couples_allowed && (
                      <span className="ml-2 text-[11px] text-foreground-secondary">couples OK</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[13px]">
                    <span className="text-foreground">{fmt(r.expected_rent_pcm)}</span>
                    {r.ai_recommended_rent_pcm != null && (
                      <span className="text-brand text-[11px]">
                        AI: {fmt(r.ai_recommended_rent_pcm)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 text-[13px] font-semibold text-foreground">
                <span>Occupancy Rate</span>
                <span>{Math.round(ev.expected_occupancy_rate * 100)}%</span>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── AI Analysis Tab ── */}
      {activeTab === "ai" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">AI Analysis</h2>
              {ev.ai_generated_at && (
                <p className="text-xs text-foreground-secondary mt-0.5">
                  Last generated{" "}
                  {new Date(ev.ai_generated_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={refreshAI}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2 text-[13px] font-medium text-foreground hover:bg-border disabled:opacity-60 transition-colors"
            >
              {aiLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {ev.ai_generated_at ? "Refresh AI Analysis" : "Get AI Recommendations"}
            </button>
          </div>

          {aiError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-[13px] text-red-400">{aiError}</p>
            </div>
          )}

          {!ev.ai_generated_at && !aiLoading && !aiError && (
            <div className="rounded-xl border border-border bg-surface-raised py-14 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
                <Sparkles className="h-7 w-7 text-brand" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">No AI analysis yet</p>
              <p className="text-xs text-foreground-secondary">
                Click &ldquo;Get AI Recommendations&rdquo; to analyse comparable portfolio data.
              </p>
            </div>
          )}

          {aiLoading && (
            <div className="rounded-xl border border-border bg-surface-raised py-14 text-center">
              <Loader2 className="h-8 w-8 text-brand animate-spin mx-auto mb-3" />
              <p className="text-sm text-foreground-secondary">
                Analysing portfolio data for comparable properties in {ev.detected_area}…
              </p>
            </div>
          )}

          {ev.ai_generated_at && !aiLoading && (
            <>
              {/* Risk Flags */}
              {ev.ai_risk_flags && ev.ai_risk_flags.length > 0 && (
                <div className="space-y-2">
                  {(ev.ai_risk_flags as RiskFlag[]).map((flag, i) => (
                    <RiskFlagBanner key={i} flag={flag} />
                  ))}
                </div>
              )}

              {/* Full reasoning */}
              {ev.ai_reasoning && (
                <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-2">
                  <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <Sparkles size={14} className="text-brand" />
                    AI Reasoning
                  </h3>
                  <p className="text-[13px] text-foreground-secondary leading-relaxed">
                    {ev.ai_reasoning}
                  </p>
                </div>
              )}

              {/* Recommended rents */}
              {ev.ai_recommended_rents && ev.ai_recommended_rents.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
                  <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <Sparkles size={14} className="text-brand" />
                    Recommended Rents
                  </h3>
                  {ev.ai_recommended_rents.map((r, i) => (
                    <div key={i} className="space-y-1 border-b border-border pb-3 last:pb-0 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground capitalize">
                          {r.room_type}
                        </span>
                        <span className="text-[13px] font-semibold text-brand">
                          {fmt(r.recommended_rent_pcm)}/mo
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground-secondary leading-relaxed">
                        {r.reasoning}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommended occupancy */}
              {ev.ai_recommended_occupancy != null && (
                <div className="rounded-xl border border-border bg-surface-raised p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[13px] font-semibold text-foreground">Recommended Occupancy</h3>
                    <span className="text-[13px] font-bold text-brand">
                      {Math.round(ev.ai_recommended_occupancy * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground-secondary">
                    Your input: {Math.round(ev.expected_occupancy_rate * 100)}%
                  </p>
                </div>
              )}

              {/* Comparables */}
              {ev.ai_comparable_properties && ev.ai_comparable_properties.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      <Building2 size={14} className="text-foreground-secondary" />
                      Comparable Properties Used
                    </h3>
                  </div>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-card">
                        <th className="px-4 py-2.5 text-left font-medium text-foreground-secondary">Area</th>
                        <th className="px-4 py-2.5 text-left font-medium text-foreground-secondary">Type</th>
                        <th className="px-4 py-2.5 text-right font-medium text-foreground-secondary">Avg Rent</th>
                        <th className="px-4 py-2.5 text-right font-medium text-foreground-secondary">Occupancy</th>
                        <th className="px-4 py-2.5 text-right font-medium text-foreground-secondary">Vacancy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(ev.ai_comparable_properties as {
                        area: string;
                        room_count: number;
                        property_type: string;
                        avg_rent_pcm: number;
                        avg_occupancy_rate: number;
                        avg_vacancy_days: number;
                      }[]).map((c, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 text-foreground">
                            {c.area} · {c.room_count} rooms
                          </td>
                          <td className="px-4 py-2.5 text-foreground-secondary capitalize">
                            {c.property_type?.replace("_", " ")}
                          </td>
                          <td className="px-4 py-2.5 text-right text-foreground">{fmt(c.avg_rent_pcm)}</td>
                          <td className="px-4 py-2.5 text-right text-foreground">
                            {Math.round(c.avg_occupancy_rate * 100)}%
                          </td>
                          <td className="px-4 py-2.5 text-right text-foreground-secondary">
                            {c.avg_vacancy_days}d
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[11px] text-foreground-secondary text-center">
                External market data (SpareRoom) coming soon — this will further improve recommendation accuracy.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Predicted vs Actual Tab ── */}
      {activeTab === "predicted_actual" && hasProfitData && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <p className="text-[13px] text-foreground-secondary leading-relaxed">
              This view compares your original projections against the actual performance of{" "}
              <Link
                href={`/properties?highlight=${ev.linked_property_id}`}
                className="text-brand hover:underline inline-flex items-center gap-1"
              >
                {ev.linked_property?.name ?? "the linked property"}
                <ExternalLink size={11} />
              </Link>
              {" "}from the Profitability module.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ComparisonCard
              label="Monthly Income"
              predicted={fmt(ev.projected_monthly_income)}
              actual="See Profitability"
              note="From live rent contracts"
            />
            <ComparisonCard
              label="Occupancy Rate"
              predicted={`${Math.round(ev.expected_occupancy_rate * 100)}%`}
              actual="See Profitability"
              note="From unit statuses"
            />
            <ComparisonCard
              label="Monthly Costs"
              predicted={fmt(ev.total_monthly_costs)}
              actual="See Profitability"
              note="From property cost records"
            />
            <ComparisonCard
              label="Break-Even"
              predicted={`${ev.break_even_months} months`}
              actual="Recalculating…"
              note="Based on actual net profit"
            />
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-foreground">Observations</h3>
              {!editingNotes ? (
                <button
                  type="button"
                  onClick={() => setEditingNotes(true)}
                  className="inline-flex items-center gap-1.5 text-[12px] text-foreground-secondary hover:text-foreground transition-colors"
                >
                  <Edit2 size={13} />
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesValue(ev.actual_vs_predicted_notes ?? "");
                    }}
                    className="text-foreground-secondary hover:text-foreground"
                  >
                    <X size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={saveNotes}
                    disabled={notesPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60 transition"
                  >
                    {notesPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save
                  </button>
                </div>
              )}
            </div>

            {editingNotes ? (
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
                placeholder="Add notes comparing predicted vs actual performance…"
                className="w-full rounded-lg border border-border bg-surface-card px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-brand resize-none"
              />
            ) : (
              <p className="text-[13px] text-foreground-secondary leading-relaxed">
                {ev.actual_vs_predicted_notes || "No observations added yet."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-card">
        <span className="text-[13px] font-semibold text-foreground">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-0">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between py-2 border-b border-border last:border-0 text-[13px]", bold && "font-semibold")}>
      <span className="text-foreground-secondary">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "red";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-4">
      <p className="text-[11px] text-foreground-secondary mb-1">{label}</p>
      <p
        className={cn(
          "text-xl font-bold",
          highlight === "green" ? "text-green-400" : highlight === "red" ? "text-red-400" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RiskFlagBanner({ flag }: { flag: RiskFlag }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl p-3 text-[13px]",
        flag.severity === "warning"
          ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
          : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
      )}
    >
      {flag.severity === "warning" ? (
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      ) : (
        <Info size={15} className="mt-0.5 shrink-0" />
      )}
      {flag.message}
    </div>
  );
}

function ComparisonCard({
  label,
  predicted,
  actual,
  note,
}: {
  label: string;
  predicted: string;
  actual: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
      <p className="text-[12px] font-semibold text-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-foreground-secondary mb-1">Predicted</p>
          <p className="text-base font-bold text-foreground">{predicted}</p>
        </div>
        <div>
          <p className="text-[10px] text-foreground-secondary mb-1">Actual</p>
          <p className="text-base font-bold text-brand">{actual}</p>
        </div>
      </div>
      {note && <p className="text-[11px] text-foreground-secondary">{note}</p>}
    </div>
  );
}
