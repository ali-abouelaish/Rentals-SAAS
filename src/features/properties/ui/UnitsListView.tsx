"use client";

import Link from "next/link";
import { differenceInDays, parseISO } from "date-fns";
import { MapPin, Clock, User, Warehouse, Pencil, Key, PoundSterling, Check } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { UnitStatusBadge } from "./UnitStatusBadge";
import { PortfolioBadge } from "./PortfolioBadge";
import { AddRoomDialog } from "./AddRoomDialog";
import { DeletePropertyButton } from "./DeletePropertyButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getActiveContractForUnit,
  recordRentPayment,
} from "@/features/contracts/actions/rent-payments";
import type { Property, Unit } from "../domain/types";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function MarkRentPaidDialog({ unit, open, onClose, onPaid }: { unit: Unit; open: boolean; onClose: () => void; onPaid: (year: number, month: number) => void }) {
  const now = new Date();
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [contract, setContract] = useState<{ id: string; rent_pcm: number; collection_date: number | null } | null>(null);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch contract once when dialog first opens
  useEffect(() => {
    if (open && !loaded) {
      setLoaded(true);
      getActiveContractForUnit(unit.id).then((c) => {
        setContract(c);
        if (c) setAmount(String(c.rent_pcm));
      });
    }
  }, [open, loaded, unit.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    startTransition(async () => {
      try {
        await recordRentPayment({
          contractId: contract.id,
          unitId: unit.id,
          periodYear,
          periodMonth,
          amount: parsed,
          notes: notes.trim() || undefined,
        });
        toast.success(`Rent marked as paid — ${MONTH_NAMES[periodMonth - 1]} ${periodYear}`);
        onPaid(periodYear, periodMonth);
        onClose();
        setNotes("");
      } catch {
        toast.error("Failed to record payment");
      }
    });
  };

  const unitLabel =
    unit.unit_type === "room"
      ? unit.room_number ? `Room ${unit.room_number}` : "Room"
      : unit.unit_type === "studio" ? "Studio" : "Whole Flat";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Mark Rent Paid — {unitLabel}</DialogTitle>
        </DialogHeader>
        {!loaded || (loaded && !contract) ? (
          <p className="text-sm text-foreground-secondary py-2">
            {loaded ? "No active contract found for this unit." : "Loading…"}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 mt-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">Amount (£)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                className="h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Month</label>
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(Number(e.target.value))}
                  className="h-9 w-full rounded-lg border border-border bg-surface-inset px-2 text-sm"
                >
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Year</label>
                <select
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                  className="h-9 w-full rounded-lg border border-border bg-surface-inset px-2 text-sm"
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. bank transfer"
                className="h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="secondary" size="sm" loading={isPending}>
                <Check className="h-3.5 w-3.5 mr-1" />
                Confirm
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatPrice(min: number | null, max: number | null): string {
  if (!min && !max) return "—";
  if (min && max && min !== max) return `£${min.toLocaleString()}–£${max.toLocaleString()}`;
  return `£${(max ?? min)!.toLocaleString()}`;
}

function formatUnitLabel(unit: Unit): string {
  if (unit.unit_type === "room") {
    const roomLabel = unit.room_type
      ? unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)
      : "Room";
    return unit.room_number ? `Room ${unit.room_number} · ${roomLabel}` : roomLabel;
  }
  if (unit.unit_type === "studio") return "Studio";
  return "Whole Flat";
}

function getDaysEmpty(unit: Unit): number | null {
  if (!["available", "move_out", "replacement"].includes(unit.status)) return null;
  if (!unit.available_date) return null;
  try {
    const days = differenceInDays(new Date(), parseISO(unit.available_date));
    return days >= 0 ? days : null;
  } catch {
    return null;
  }
}

function formatPropertyType(type: string) {
  if (type === "hmo") return "HMO";
  if (type === "studio") return "Studio";
  return "Whole Flat";
}

/* Column layout shared between header and rows */
const COLS = "grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_80px]";

function UnitRow({
  unit,
  onUnitClick,
  striped,
}: {
  unit: Unit;
  onUnitClick: (id: string) => void;
  striped: boolean;
}) {
  const now = new Date();
  const daysEmpty = getDaysEmpty(unit);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paidThisMonth, setPaidThisMonth] = useState(false);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onUnitClick(unit.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onUnitClick(unit.id); }}
        className={cn(
          COLS,
          "w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-inset cursor-pointer",
          striped && "bg-surface-inset/40"
        )}
      >
        {/* Unit label */}
        <div className="flex items-center min-w-0 pl-5 border-l-2 border-border">
          <span className="text-sm font-medium text-foreground">{formatUnitLabel(unit)}</span>
        </div>

        {/* Status */}
        <div className="flex items-center">
          <UnitStatusBadge status={unit.status} size="sm" />
        </div>

        {/* Available date */}
        <div className="flex items-center">
          {unit.available_date ? (
            <span className="text-xs text-foreground-secondary">
              {new Date(unit.available_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </span>
          ) : (
            <span className="text-xs text-foreground-muted">—</span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center">
          <span className="text-sm font-medium text-foreground tabular-nums">
            {formatPrice(unit.min_price_pcm, unit.max_price_pcm)}
          </span>
        </div>

        {/* Tenant */}
        <div className="flex items-center min-w-0">
          {unit.resident ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-5 w-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <User className="h-3 w-3 text-brand" />
              </div>
              <span className="text-xs text-foreground truncate">{unit.resident.full_name}</span>
            </div>
          ) : (
            <span className="text-xs text-foreground-muted">Vacant</span>
          )}
        </div>

        {/* Days empty */}
        <div className="flex items-center justify-center">
          {daysEmpty !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
                daysEmpty === 0
                  ? "bg-green-50 text-green-700"
                  : daysEmpty <= 7
                  ? "bg-amber-50 text-amber-700"
                  : daysEmpty <= 30
                  ? "bg-orange-50 text-orange-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              <Clock className="h-2.5 w-2.5" />
              {daysEmpty}d
            </span>
          ) : (
            <span className="text-xs text-foreground-muted">—</span>
          )}
        </div>

        {/* Mark rent paid action */}
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title={paidThisMonth ? "Rent paid this month" : "Mark rent paid"}
            onClick={() => setDialogOpen(true)}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
              paidThisMonth
                ? "border-green-400 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-border bg-surface-card text-foreground-secondary hover:border-green-400 hover:text-green-700 hover:bg-green-50"
            )}
          >
            <PoundSterling className="h-3 w-3" />
            Paid
          </button>
        </div>
      </div>

      <MarkRentPaidDialog
        unit={unit}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onPaid={(year, month) => {
          if (year === now.getFullYear() && month === now.getMonth() + 1) {
            setPaidThisMonth(true);
          }
        }}
      />
    </>
  );
}

function PropertyGroup({
  property,
  units,
  onUnitClick,
  onUnitCreated,
  onPropertyDeleted,
}: {
  property: Property;
  units: Unit[];
  onUnitClick: (id: string) => void;
  onUnitCreated: (unit: Unit) => void;
  onPropertyDeleted: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      {/* Property header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-inset/60 border-b border-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
          <Warehouse className="h-4 w-4 text-brand" strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/properties/${property.id}`}
              className="text-sm font-semibold text-foreground hover:text-brand hover:underline transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {property.name}
            </Link>
            <span className="rounded-full bg-surface-card border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground-muted uppercase tracking-wide">
              {formatPropertyType(property.property_type)}
            </span>
            {property.portfolio && <PortfolioBadge portfolio={property.portfolio} />}
            {property.owner_landlord && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                <Key className="h-2.5 w-2.5" />
                {property.owner_landlord.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-foreground-muted mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {property.address_line_1}
              {property.postcode && `, ${property.postcode}`}
              {property.area && ` · ${property.area}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <span className="text-xs text-foreground-muted mr-1">
            {units.length} {units.length === 1 ? "unit" : "units"}
          </span>
          <AddRoomDialog property={property} onCreated={onUnitCreated} />
          <Link
            href={`/properties/${property.id}/edit`}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-surface-inset hover:bg-surface-card transition-colors text-foreground-muted hover:text-foreground"
            title="Edit property"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <DeletePropertyButton
            propertyId={property.id}
            propertyName={property.name}
            onDeleted={() => onPropertyDeleted(property.id)}
          />
        </div>
      </div>

      {/* Column header (only when there are units) */}
      {units.length > 0 && (
        <div className={cn(COLS, "gap-3 px-4 py-2 border-b border-border/50 bg-surface-inset/30")}>
          <div className="pl-5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Unit</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Status</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Available</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Price PCM</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Tenant</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted text-center">Empty</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted text-right">Rent</div>
        </div>
      )}

      {/* Unit rows */}
      {units.length > 0 ? (
        <div className="divide-y divide-border">
          {units.map((unit, i) => (
            <UnitRow key={unit.id} unit={unit} onUnitClick={onUnitClick} striped={i % 2 === 1} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 py-6 text-center">
          <p className="text-sm text-foreground-muted">No rooms yet</p>
          <AddRoomDialog property={property} onCreated={onUnitCreated} />
        </div>
      )}
    </div>
  );
}

interface UnitsListViewProps {
  properties: Property[];
  units: Unit[];
  onUnitClick: (unitId: string) => void;
  onUnitCreated: (unit: Unit) => void;
  onPropertyDeleted: (propertyId: string) => void;
}

export function UnitsListView({ properties, units, onUnitClick, onUnitCreated, onPropertyDeleted }: UnitsListViewProps) {
  if (properties.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-card py-16 text-center">
        <Warehouse className="h-10 w-10 text-foreground-muted mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground mb-1">No properties found</p>
        <p className="text-xs text-foreground-secondary">Try adjusting your filters or add a new property</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {properties.map((property) => {
        const propertyUnits = units.filter((u) => u.property_id === property.id);
        return (
          <PropertyGroup
            key={property.id}
            property={property}
            units={propertyUnits}
            onUnitClick={onUnitClick}
            onUnitCreated={onUnitCreated}
            onPropertyDeleted={onPropertyDeleted}
          />
        );
      })}
    </div>
  );
}
