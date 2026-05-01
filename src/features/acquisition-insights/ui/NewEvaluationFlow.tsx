"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createEvaluation } from "../actions/evaluations";
import {
  EvaluationFormSchema,
  EvaluationFormValues,
  LONDON_AREAS,
  detectAreaFromPostcode,
  calculateBreakEven,
  poundsToP,
} from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";

const ROOM_TYPES = ["single", "double", "master", "ensuite"] as const;
const STEP_LABELS = [
  "Property Details",
  "Setup Costs",
  "Monthly Costs",
  "Room Config",
  "AI Analysis",
  "Results",
];

const fmt = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);

const ptp = (v: number | null | undefined) => poundsToP(v);

interface NewEvaluationFlowProps {
  portfolios: Portfolio[];
}

type AIOutputType = {
  recommended_rents?: { room_type: string; recommended_rent_pcm: number; reasoning: string }[];
  recommended_occupancy?: number;
  occupancy_reasoning?: string;
  comparable_properties_used?: { area: string; room_count: number; property_type: string; avg_rent_pcm: number; avg_occupancy_rate: number; avg_vacancy_days: number }[];
  risk_flags?: { severity: string; message: string }[];
  market_listings?: {
    count: number;
    median_rent_pounds: number | null;
    min_rent_pounds: number | null;
    max_rent_pounds: number | null;
    last_scraped_at: string | null;
    listings: {
      url: string;
      title: string | null;
      location_text: string | null;
      property_type: string | null;
      price: number | null;
      room_count: number | null;
      min_room_price_pcm: number | null;
      max_room_price_pcm: number | null;
      latitude: number | null;
      longitude: number | null;
      distance_miles: number | null;
      scraped_at: string;
    }[];
  };
} | null;

export function NewEvaluationFlow({ portfolios }: NewEvaluationFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [aiOutput, setAiOutput] = useState<AIOutputType>(null);

  const form = useForm<EvaluationFormValues>({
    resolver: zodResolver(EvaluationFormSchema),
    defaultValues: {
      portfolio_id: portfolios[0]?.id ?? "",
      address: "",
      postcode: "",
      detected_area: "",
      property_type: "hmo",
      total_rooms: 4,
      furnished: true,
      rent_to_landlord_pcm: 0,
      expected_occupancy_rate: 0.88,
      rooms: [
        { room_number: 1, room_type: "double", expected_rent_pcm: 1000, ai_recommended_rent_pcm: null, couples_allowed: false },
      ],
    },
  });

  const { fields: roomFields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "rooms",
  });

  const watchFurnished = form.watch("furnished");
  const watchRooms = form.watch("rooms");
  const watchOccupancy = form.watch("expected_occupancy_rate");
  const watchPropertyType = form.watch("property_type");
  const watchTotalRooms = form.watch("total_rooms");

  // Auto-detect area when postcode changes
  const handlePostcodeBlur = () => {
    const postcode = form.getValues("postcode");
    if (!postcode) return;
    const detected = detectAreaFromPostcode(postcode);
    if (detected && !form.getValues("detected_area")) {
      form.setValue("detected_area", detected);
    }
  };

  // Sync room fields with total_rooms
  const syncRooms = useCallback(
    (count: number) => {
      const existing = form.getValues("rooms");
      if (count > existing.length) {
        const toAdd = Array.from({ length: count - existing.length }, (_, i) => ({
          room_number: existing.length + i + 1,
          room_type: "double" as const,
          expected_rent_pcm: 1000,
          ai_recommended_rent_pcm: null,
          couples_allowed: false,
        }));
        replace([...existing, ...toAdd]);
      } else if (count < existing.length) {
        replace(existing.slice(0, count));
      }
    },
    [form, replace]
  );

  // ── Calculated preview ─────────────────────────────────
  const calcPreview = () => {
    const vals = form.getValues();
    return calculateBreakEven({
      rooms: (vals.rooms ?? []).map((r) => ({
        ...r,
        expected_rent_pcm: ptp(r.expected_rent_pcm),
        ai_recommended_rent_pcm: r.ai_recommended_rent_pcm ? ptp(r.ai_recommended_rent_pcm) : null,
      })),
      occupancy_rate: vals.expected_occupancy_rate ?? 0.88,
      rent_to_landlord_pcm: ptp(vals.rent_to_landlord_pcm),
      bills_pcm: ptp(vals.bills_pcm),
      council_tax_pcm: ptp(vals.council_tax_pcm),
      cleaning_pcm: ptp(vals.cleaning_pcm),
      insurance_pcm: ptp(vals.insurance_pcm),
      other_costs_pcm: ptp(vals.other_costs_pcm),
      furniture_cost: ptp(vals.furniture_cost),
      refurbishment_cost: ptp(vals.refurbishment_cost),
      upfront_fees: ptp(vals.upfront_fees),
      agency_fees: ptp(vals.agency_fees),
      other_setup_costs: ptp(vals.other_setup_costs),
    });
  };

  // ── AI Recommendations ──────────────────────────────────
  const runAI = async () => {
    const vals = form.getValues();
    if (!vals.detected_area || !vals.address) {
      toast.error("Please complete the property details first.");
      return;
    }
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch("/api/acquisition-insights/ai-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: vals.address,
          postcode: vals.postcode,
          detected_area: vals.detected_area,
          property_type: vals.property_type,
          total_rooms: vals.total_rooms,
          rooms: vals.rooms.map((r) => ({
            ...r,
            expected_rent_pcm: ptp(r.expected_rent_pcm),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI request failed");

      // Map recommended rents back to form rooms
      const updatedRooms = vals.rooms.map((r) => {
        const rec = data.recommended_rents?.find(
          (rr: { room_type: string; recommended_rent_pcm: number }) => rr.room_type === r.room_type
        );
        return {
          ...r,
          ai_recommended_rent_pcm: rec ? rec.recommended_rent_pcm / 100 : null,
        };
      });
      form.setValue("rooms", updatedRooms);
      setAiOutput(data as AIOutputType);
      setAiDone(true);
      toast.success("AI recommendations ready.");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  };

  const acceptAIRents = () => {
    const vals = form.getValues();
    const updated = vals.rooms.map((r) => ({
      ...r,
      expected_rent_pcm: r.ai_recommended_rent_pcm ?? r.expected_rent_pcm,
    }));
    form.setValue("rooms", updated);
    if (aiOutput?.recommended_occupancy) {
      form.setValue("expected_occupancy_rate", aiOutput.recommended_occupancy);
    }
    toast.success("AI recommendations applied.");
  };

  // ── Save ───────────────────────────────────────────────
  const onSave = async () => {
    setSaving(true);
    try {
      const vals = form.getValues();
      const id = await createEvaluation(vals);
      toast.success("Evaluation saved.");
      router.push(`/acquisition-insights/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const calc = calcPreview();

  const inputClass =
    "h-10 w-full rounded-lg border border-border bg-surface-card px-3 text-[13px] text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-brand";
  const labelClass = "block text-[13px] font-medium text-foreground mb-1.5";
  const moneyInputClass =
    "h-10 w-full rounded-lg border border-border bg-surface-card pl-7 pr-3 text-[13px] text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          New Evaluation
        </h1>
        <p className="text-sm text-foreground-secondary mt-0.5">
          Assess a potential property for acquisition
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => setStep(i)}
              className="flex flex-col items-center gap-1 flex-1"
            >
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  i < step
                    ? "bg-brand"
                    : i === step
                    ? "bg-brand"
                    : "bg-border"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium hidden sm:block",
                  i === step ? "text-brand" : "text-foreground-secondary"
                )}
              >
                {label}
              </span>
            </button>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-border bg-surface-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-5">
          Step {step + 1}: {STEP_LABELS[step]}
        </h2>

        {/* ── Step 0: Property Details ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Portfolio</label>
              <select
                {...form.register("portfolio_id")}
                className={inputClass}
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.portfolio_id && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.portfolio_id.message}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Address</label>
              <input
                {...form.register("address")}
                placeholder="e.g. 28 Romford Road"
                className={inputClass}
              />
              {form.formState.errors.address && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Postcode</label>
                <input
                  {...form.register("postcode")}
                  placeholder="e.g. E15 4BZ"
                  onBlur={handlePostcodeBlur}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Detected Area
                  <span className="ml-1 text-[11px] font-normal text-foreground-secondary">(auto-detected)</span>
                </label>
                <select {...form.register("detected_area")} className={inputClass}>
                  <option value="">Select area…</option>
                  {LONDON_AREAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                {form.formState.errors.detected_area && (
                  <p className="text-xs text-red-400 mt-1">{form.formState.errors.detected_area.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Property Type</label>
                <select {...form.register("property_type")} className={inputClass}>
                  <option value="hmo">HMO</option>
                  <option value="studio">Studio</option>
                  <option value="whole_flat">Whole Flat</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Total Rooms</label>
                <input
                  {...form.register("total_rooms", { valueAsNumber: true })}
                  type="number"
                  min={1}
                  max={20}
                  className={inputClass}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    form.setValue("total_rooms", v);
                    if (!isNaN(v) && v > 0) syncRooms(v);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-raised border border-border">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...form.register("furnished")}
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                />
                <div>
                  <span className="text-[13px] font-medium text-foreground">Furnished</span>
                  <p className="text-[11px] text-foreground-secondary">
                    Uncheck if you need to budget for furniture
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* ── Step 1: Setup Costs ── */}
        {step === 1 && (
          <div className="space-y-4">
            {!watchFurnished && (
              <MoneyField
                label="Furniture Cost"
                reg={form.register("furniture_cost", { valueAsNumber: true })}
                placeholder="0"
              />
            )}
            <MoneyField
              label="Refurbishment Cost"
              reg={form.register("refurbishment_cost", { valueAsNumber: true })}
              placeholder="0"
            />
            <MoneyField
              label="Upfront Fees"
              hint="Deposit to landlord, admin fees"
              reg={form.register("upfront_fees", { valueAsNumber: true })}
              placeholder="0"
            />
            <MoneyField
              label="Agency Fees"
              reg={form.register("agency_fees", { valueAsNumber: true })}
              placeholder="0"
            />
            <div className="grid grid-cols-2 gap-4">
              <MoneyField
                label="Other Setup Costs"
                reg={form.register("other_setup_costs", { valueAsNumber: true })}
                placeholder="0"
              />
              <div>
                <label className={labelClass}>Other Costs Label</label>
                <input
                  {...form.register("other_setup_costs_label")}
                  placeholder="e.g. Licensing fees"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-brand/5 border border-brand/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-foreground">Total Setup Cost</span>
                <span className="text-xl font-bold text-brand">{fmt(calc.total_setup_cost)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Monthly Costs ── */}
        {step === 2 && (
          <div className="space-y-4">
            <MoneyField
              label="Rent to Landlord PCM"
              reg={form.register("rent_to_landlord_pcm", { valueAsNumber: true })}
              placeholder="0"
              required
              error={form.formState.errors.rent_to_landlord_pcm?.message}
            />
            <div className="grid grid-cols-2 gap-4">
              <MoneyField label="Bills PCM" reg={form.register("bills_pcm", { valueAsNumber: true })} placeholder="0" />
              <MoneyField label="Council Tax PCM" reg={form.register("council_tax_pcm", { valueAsNumber: true })} placeholder="0" />
              <MoneyField label="Cleaning PCM" reg={form.register("cleaning_pcm", { valueAsNumber: true })} placeholder="0" />
              <MoneyField label="Insurance PCM" reg={form.register("insurance_pcm", { valueAsNumber: true })} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MoneyField label="Other Costs PCM" reg={form.register("other_costs_pcm", { valueAsNumber: true })} placeholder="0" />
              <div>
                <label className={labelClass}>Other Costs Label</label>
                <input {...form.register("other_costs_label")} placeholder="e.g. Garden maintenance" className={inputClass} />
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-brand/5 border border-brand/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-foreground">Total Monthly Costs</span>
                <span className="text-xl font-bold text-brand">{fmt(calc.total_monthly_costs)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Room Configuration ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] text-foreground-secondary">
                Configure each room. AI-recommended rents will appear after Step 5.
              </p>
              <button
                type="button"
                onClick={() => {
                  append({
                    room_number: roomFields.length + 1,
                    room_type: "double",
                    expected_rent_pcm: 1000,
                    ai_recommended_rent_pcm: null,
                    couples_allowed: false,
                  });
                  form.setValue("total_rooms", roomFields.length + 1);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised border border-border px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-border transition-colors"
              >
                <Plus size={14} />
                Add Room
              </button>
            </div>

            <div className="space-y-3">
              {roomFields.map((field, idx) => {
                const aiRec = form.watch(`rooms.${idx}.ai_recommended_rent_pcm`);
                return (
                  <div
                    key={field.id}
                    className="rounded-xl border border-border bg-surface-raised p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-foreground">
                        Room {idx + 1}
                      </span>
                      {roomFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            remove(idx);
                            form.setValue("total_rooms", roomFields.length - 1);
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Room Type</label>
                        <select
                          {...form.register(`rooms.${idx}.room_type`)}
                          className={inputClass}
                        >
                          {ROOM_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>
                          Expected Rent PCM
                          {aiRec != null && aiRec > 0 && (
                            <span className="ml-2 text-[11px] font-normal text-brand">
                              AI: £{aiRec.toFixed(0)}
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary text-[13px]">£</span>
                          <input
                            {...form.register(`rooms.${idx}.expected_rent_pcm`, { valueAsNumber: true })}
                            type="number"
                            min={1}
                            className={moneyInputClass}
                          />
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        {...form.register(`rooms.${idx}.couples_allowed`)}
                        className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                      />
                      <span className="text-[13px] text-foreground-secondary">Couples allowed</span>
                    </label>
                  </div>
                );
              })}
            </div>

            <div>
              <label className={labelClass}>
                Occupancy Rate
                <span className="ml-1 text-[11px] font-normal text-foreground-secondary">
                  (AI will recommend one in the next step)
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.01}
                  {...form.register("expected_occupancy_rate", { valueAsNumber: true })}
                  className="flex-1"
                />
                <span className="text-sm font-semibold text-foreground w-12 text-right">
                  {Math.round(watchOccupancy * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: AI Recommendations ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 mx-auto">
                <Sparkles className="h-8 w-8 text-brand" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  AI analyses your portfolio for comparable properties in{" "}
                  <span className="text-brand">{form.watch("detected_area") || "this area"}</span>
                </p>
                <p className="text-xs text-foreground-secondary mt-1">
                  Results are based on your existing portfolio data — actual rents, occupancy, and vacancy patterns.
                </p>
              </div>

              {!aiDone && !aiLoading && (
                <button
                  type="button"
                  onClick={runAI}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-fg shadow-glow hover:opacity-90 transition"
                >
                  <Sparkles size={16} />
                  Get AI Recommendations
                </button>
              )}

              {aiLoading && (
                <div className="flex items-center gap-3 justify-center text-foreground-secondary">
                  <Loader2 size={18} className="animate-spin text-brand" />
                  <span className="text-[13px]">
                    Analysing your portfolio data for comparable properties in {form.watch("detected_area") || "this area"}…
                  </span>
                </div>
              )}

              {aiError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-left">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[13px] font-semibold text-red-400">AI request failed</p>
                      <p className="text-xs text-red-400/80 mt-0.5">{aiError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={runAI}
                    className="mt-3 text-xs text-brand hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* AI Results */}
            {aiDone && aiOutput && (
              <div className="space-y-4">
                {/* Risk Flags */}
                {aiOutput.risk_flags && aiOutput.risk_flags.length > 0 && (
                  <div className="space-y-2">
                    {aiOutput.risk_flags.map((flag, i) => (
                      <div
                        key={i}
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
                    ))}
                  </div>
                )}

                {/* Recommended Rents */}
                <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
                  <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <Sparkles size={14} className="text-brand" />
                    Recommended Rents
                  </h3>
                  {aiOutput.recommended_rents?.map((r, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-foreground capitalize">{r.room_type}</span>
                        <span className="text-[13px] font-semibold text-brand">
                          £{(r.recommended_rent_pcm / 100).toFixed(0)}/mo
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground-secondary leading-relaxed">{r.reasoning}</p>
                    </div>
                  ))}
                </div>

                {/* Occupancy */}
                <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-2">
                  <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <Sparkles size={14} className="text-brand" />
                    Recommended Occupancy
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-foreground">Occupancy rate</span>
                    <span className="text-[13px] font-semibold text-brand">
                      {Math.round((aiOutput.recommended_occupancy ?? 0) * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground-secondary leading-relaxed">
                    {aiOutput.occupancy_reasoning}
                  </p>
                </div>

                {/* Comparable Properties */}
                {aiOutput.comparable_properties_used && aiOutput.comparable_properties_used.length > 0 && (
                  <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
                    <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      <Building2 size={14} className="text-foreground-secondary" />
                      Comparable Properties Used
                    </h3>
                    {aiOutput.comparable_properties_used.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <span className="text-foreground">
                          {c.area} · {c.property_type?.replace("_", " ")} · {c.room_count} rooms
                        </span>
                        <span className="text-foreground-secondary">
                          £{(c.avg_rent_pcm / 100).toFixed(0)}/mo · {Math.round(c.avg_occupancy_rate * 100)}% occ · {c.avg_vacancy_days}d vacancy
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* SpareRoom Market Listings */}
                {aiOutput.market_listings && aiOutput.market_listings.count > 0 && (
                  <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
                    <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      <Building2 size={14} className="text-foreground-secondary" />
                      SpareRoom Listings near {form.watch("postcode")}
                    </h3>
                    <div className="text-[12px] text-foreground-secondary">
                      {aiOutput.market_listings.count} listings · range £
                      {aiOutput.market_listings.min_rent_pounds ?? "?"}–£
                      {aiOutput.market_listings.max_rent_pounds ?? "?"} pcm · median £
                      {aiOutput.market_listings.median_rent_pounds ?? "?"} pcm
                      {aiOutput.market_listings.last_scraped_at && (
                        <>
                          {" "}
                          · last scraped{" "}
                          {new Date(aiOutput.market_listings.last_scraped_at).toLocaleDateString()}
                        </>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {aiOutput.market_listings.listings.slice(0, 8).map((l) => (
                        <li key={l.url} className="text-[12px]">
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline"
                          >
                            {l.title ?? l.url}
                          </a>
                          <span className="text-foreground-secondary">
                            {l.location_text ? ` · ${l.location_text}` : ""}
                            {l.distance_miles != null ? ` · ${l.distance_miles.toFixed(2)}mi` : ""}
                            {l.room_count ? ` · ${l.room_count} rooms` : ""}
                            {l.min_room_price_pcm
                              ? ` · £${l.min_room_price_pcm}${
                                  l.max_room_price_pcm && l.max_room_price_pcm !== l.min_room_price_pcm
                                    ? `–£${l.max_room_price_pcm}`
                                    : ""
                                } pcm`
                              : l.price
                              ? ` · £${l.price} pcm`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={acceptAIRents}
                    className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-brand-fg hover:opacity-90 transition"
                  >
                    Accept AI Recommendations
                  </button>
                  <button
                    type="button"
                    onClick={runAI}
                    className="rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-border transition"
                  >
                    Refresh
                  </button>
                </div>

                {(!aiOutput.market_listings || aiOutput.market_listings.count === 0) && (
                  <p className="text-[11px] text-foreground-secondary text-center">
                    No SpareRoom listings cached for this postcode yet — run the market scraper
                    (scripts/MARKET_SCRAPER.py) to populate.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Results ── */}
        {step === 5 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <ResultCard
                label="Projected Monthly Income"
                value={fmt(calc.projected_monthly_income)}
                sub={`at ${Math.round(watchOccupancy * 100)}% occupancy`}
              />
              <ResultCard
                label="Total Monthly Costs"
                value={fmt(calc.total_monthly_costs)}
              />
              <ResultCard
                label="Monthly Net Profit"
                value={fmt(calc.monthly_net_profit)}
                highlight={calc.monthly_net_profit > 0 ? "green" : "red"}
              />
              <ResultCard
                label="Total Setup Cost"
                value={fmt(calc.total_setup_cost)}
              />
            </div>

            {calc.monthly_net_profit > 0 && calc.total_setup_cost > 0 ? (
              <div className="rounded-2xl bg-brand/5 border border-brand/20 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Break-Even</span>
                  <span className="text-2xl font-bold text-brand">
                    {calc.break_even_months} months
                  </span>
                </div>
                {calc.break_even_date && (
                  <p className="text-[13px] text-foreground-secondary">
                    Estimated:{" "}
                    {new Date(calc.break_even_date).toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-brand/10">
                  <span className="text-sm font-semibold text-foreground">Annual ROI</span>
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      calc.annual_roi_percentage >= 15
                        ? "text-green-400"
                        : calc.annual_roi_percentage >= 8
                        ? "text-amber-400"
                        : "text-foreground"
                    )}
                  >
                    {calc.annual_roi_percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-red-400">Not profitable at current figures</p>
                  <p className="text-xs text-red-400/80 mt-0.5">
                    Monthly costs exceed projected income. Review your inputs in previous steps.
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-foreground-secondary text-center">
              Saving as &ldquo;Considering&rdquo; — you can change the status after reviewing.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {step < 5 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-[13px] font-semibold text-brand-fg shadow-glow hover:opacity-90 transition"
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-[13px] font-semibold text-brand-fg shadow-glow hover:opacity-90 disabled:opacity-60 transition"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Save Evaluation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────

function MoneyField({
  label,
  hint,
  reg,
  placeholder,
  required,
  error,
}: {
  label: string;
  hint?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reg: any;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-foreground mb-1.5">
        {label}
        {hint && <span className="ml-1 text-[11px] font-normal text-foreground-secondary">({hint})</span>}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary text-[13px]">£</span>
        <input
          {...reg}
          type="number"
          min={0}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-border bg-surface-card pl-7 pr-3 text-[13px] text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function ResultCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "red";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-4">
      <p className="text-[12px] text-foreground-secondary mb-1">{label}</p>
      <p
        className={cn(
          "text-xl font-bold",
          highlight === "green"
            ? "text-green-400"
            : highlight === "red"
            ? "text-red-400"
            : "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-foreground-secondary mt-0.5">{sub}</p>}
    </div>
  );
}
