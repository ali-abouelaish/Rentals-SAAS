"use client";

import { MapPin, Warehouse, Phone, Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PublicShareUnit } from "../data/public";
import { STATUS_CONFIG } from "@/features/properties/domain/types";
import type { UnitStatus } from "@/features/properties/domain/types";
import { formatPriceRange, unitLabel as sharedUnitLabel } from "./format";

const MONTH_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

// Compact on phones (Unit · Availability · Price); Commission + Contact
// reveal on lg+ where there's room. Both stay available in the unit drawer.
const COLS = "grid grid-cols-[1.6fr_1.2fr_1fr] gap-3 lg:grid-cols-[1.6fr_1.2fr_1fr_1fr_2fr]";

function unitLabel(u: PublicShareUnit): string {
  return sharedUnitLabel(u);
}

function availabilityChip(u: PublicShareUnit) {
  if ((u.notice_given || u.status === "move_out") && u.available_date) {
    return {
      label: `Available ${MONTH_DAY.format(new Date(u.available_date))}`,
      className: "bg-amber-100 text-amber-800",
    };
  }
  if (u.status === "available") {
    if (u.available_date && new Date(u.available_date).getTime() > Date.now()) {
      return {
        label: `Available ${MONTH_DAY.format(new Date(u.available_date))}`,
        className: "bg-amber-100 text-amber-800",
      };
    }
    return { label: "Available now", className: "bg-emerald-100 text-emerald-800" };
  }
  const cfg = STATUS_CONFIG[u.status as UnitStatus];
  return { label: cfg?.label ?? u.status, className: "bg-slate-100 text-slate-700" };
}

function contactLinks(contact: PublicShareUnit["contact"]) {
  if (!contact) return null;
  const waNumber = (contact.whatsapp_number ?? contact.phone ?? "").replace(/[^0-9]/g, "");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-foreground truncate max-w-[140px]">{contact.full_name}</span>
      {contact.phone && (
        <a
          href={`tel:${contact.phone}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface-card text-foreground-secondary hover:text-foreground"
          title={`Call ${contact.phone}`}
        >
          <Phone className="h-3 w-3" />
        </a>
      )}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface-card text-foreground-secondary hover:text-foreground"
          title={`Email ${contact.email}`}
        >
          <Mail className="h-3 w-3" />
        </a>
      )}
      {waNumber && (
        <a
          href={`https://wa.me/${waNumber}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface-card text-foreground-secondary hover:text-foreground"
          title="WhatsApp"
        >
          <MessageCircle className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function UnitRow({
  unit,
  commissionPct,
  striped,
  onOpenInfo,
}: {
  unit: PublicShareUnit;
  commissionPct: number;
  striped: boolean;
  onOpenInfo: (unit: PublicShareUnit) => void;
}) {
  const chip = availabilityChip(unit);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenInfo(unit)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenInfo(unit);
        }
      }}
      className={cn(
        COLS,
        "w-full cursor-pointer text-left px-4 py-3 text-sm hover:bg-surface-inset/60 focus:outline-none focus:bg-surface-inset/60 transition-colors",
        striped && "bg-surface-inset/40"
      )}
    >
      <div className="flex items-center min-w-0 pl-5 border-l-2 border-border">
        <span className="font-medium text-foreground truncate">{unitLabel(unit)}</span>
      </div>
      <div className="flex items-center">
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", chip.className)}>
          {chip.label}
        </span>
      </div>
      <div className="flex items-center tabular-nums text-foreground">
        {formatPriceRange(unit.min_price_pcm, unit.max_price_pcm)}
      </div>
      <div className="hidden lg:flex items-center tabular-nums text-foreground">
        {commissionPct}%
      </div>
      <div className="hidden lg:flex items-center min-w-0" onClick={(e) => e.stopPropagation()}>
        {unit.contact ? contactLinks(unit.contact) : <span className="text-xs text-foreground-muted">—</span>}
      </div>
    </div>
  );
}

function PropertyGroup({
  property,
  units,
  commissionPct,
  onOpenInfo,
}: {
  property: PublicShareUnit["property"];
  units: PublicShareUnit[];
  commissionPct: number;
  onOpenInfo: (unit: PublicShareUnit) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-inset/60 border-b border-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
          <Warehouse className="h-4 w-4 text-brand" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{property.name}</span>
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
        <span className="text-xs text-foreground-muted shrink-0">
          {units.length} {units.length === 1 ? "unit" : "units"}
        </span>
      </div>

      <div className={cn(COLS, "px-4 py-2 border-b border-border/50 bg-surface-inset/30 sticky top-0 z-10")}>
        <div className="pl-5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Unit</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Availability</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Price PCM</div>
        <div className="hidden lg:block text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Commission</div>
        <div className="hidden lg:block text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Contact</div>
      </div>

      <div className="divide-y divide-border">
        {units.map((u, i) => (
          <UnitRow
            key={u.id}
            unit={u}
            commissionPct={commissionPct}
            striped={i % 2 === 1}
            onOpenInfo={onOpenInfo}
          />
        ))}
      </div>
    </div>
  );
}

export function UnitsTableView({
  units,
  commissionPct,
  onOpenInfo,
}: {
  units: PublicShareUnit[];
  commissionPct: number;
  onOpenInfo: (unit: PublicShareUnit) => void;
}) {
  const groups = new Map<string, { property: PublicShareUnit["property"]; units: PublicShareUnit[] }>();
  for (const u of units) {
    const key = u.property.id;
    const bucket = groups.get(key) ?? { property: u.property, units: [] };
    bucket.units.push(u);
    groups.set(key, bucket);
  }
  const orderedGroups = Array.from(groups.values());

  return (
    <div className="space-y-3">
      {orderedGroups.map((g) => (
        <PropertyGroup
          key={g.property.id}
          property={g.property}
          units={g.units}
          commissionPct={commissionPct}
          onOpenInfo={onOpenInfo}
        />
      ))}
    </div>
  );
}
