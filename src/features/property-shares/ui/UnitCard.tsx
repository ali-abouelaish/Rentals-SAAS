"use client";

import Image from "next/image";
import { ArrowUpRight, Home, Images } from "lucide-react";
import type { PublicShareUnit } from "../data/public";
import { STATUS_CONFIG } from "@/features/properties/domain/types";
import type { UnitStatus } from "@/features/properties/domain/types";
import { formatPriceRange, unitLabel } from "./format";

interface UnitCardProps {
  unit: PublicShareUnit;
  commissionPct: number;
  onOpenInfo: (unit: PublicShareUnit) => void;
}

const MONTH_DAY = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

function availabilityLabel(unit: PublicShareUnit): { label: string; tone: "green" | "amber" | "slate" } {
  if (unit.notice_given && unit.available_date) {
    return { label: `Available from ${MONTH_DAY.format(new Date(unit.available_date))}`, tone: "amber" };
  }
  if (unit.status === "available") {
    if (unit.available_date && new Date(unit.available_date).getTime() > Date.now()) {
      return { label: `Available from ${MONTH_DAY.format(new Date(unit.available_date))}`, tone: "amber" };
    }
    return { label: "Available now", tone: "green" };
  }
  const cfg = STATUS_CONFIG[unit.status as UnitStatus];
  return { label: cfg?.label ?? unit.status, tone: "slate" };
}

export function UnitCard({ unit, commissionPct, onOpenInfo }: UnitCardProps) {
  const hero = unit.photos[0]?.url || null;
  const avail = availabilityLabel(unit);
  const fullAddress = [unit.property.address_line_1, unit.property.address_line_2]
    .filter(Boolean)
    .join(", ");

  const badgeClass =
    avail.tone === "green"
      ? "bg-emerald-50/95 text-emerald-800 ring-emerald-600/10"
      : avail.tone === "amber"
      ? "bg-amber-50/95 text-amber-800 ring-amber-600/10"
      : "bg-white/95 text-slate-700 ring-slate-900/10";

  const dotClass =
    avail.tone === "green"
      ? "bg-emerald-500"
      : avail.tone === "amber"
      ? "bg-amber-500"
      : "bg-slate-400";

  const label = unitLabel(unit);
  const hasPhotos = unit.photos.length > 0;
  const priceRange = formatPriceRange(unit.min_price_pcm, unit.max_price_pcm);

  return (
    <button
      type="button"
      onClick={() => onOpenInfo(unit)}
      className="group relative flex w-full flex-col overflow-hidden rounded-3xl border border-border bg-surface-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/40"
    >
      <div className="relative block w-full aspect-[4/3] bg-surface-inset overflow-hidden">
        {hero ? (
          <Image
            src={hero}
            alt={`${unit.property.name} - ${label}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-foreground-muted">
            <Home className="h-10 w-10" />
          </div>
        )}

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 via-black/10 to-transparent"
        />

        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] ring-1 backdrop-blur ${badgeClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          {avail.label}
        </span>

        {hasPhotos && unit.photos.length > 1 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            <Images className="h-3 w-3" />
            {unit.photos.length}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
              {label}
            </p>
            <h3
              className="mt-1 truncate text-[1.2rem] leading-tight tracking-[-0.01em] text-foreground"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              {unit.property.name}
            </h3>
          </div>
          <div className="shrink-0 text-right">
            <p
              className="text-[1.05rem] leading-none tracking-[-0.005em] text-foreground tabular-nums"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              {priceRange}
            </p>
            {unit.couples_allowed && unit.couples_price_pcm && (
              <p className="mt-1 text-[11px] text-foreground-muted tabular-nums">
                Couples £{unit.couples_price_pcm.toLocaleString("en-GB")}
              </p>
            )}
          </div>
        </div>

        {(fullAddress || unit.property.postcode) && (
          <p className="mt-2 truncate text-sm text-foreground-secondary">
            {fullAddress}
            {unit.property.postcode ? ` · ${unit.property.postcode}` : ""}
          </p>
        )}

        <div
          className="mt-5 flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm"
          style={{
            backgroundImage:
              "linear-gradient(120deg, color-mix(in oklab, var(--brand-primary) 8%, transparent), color-mix(in oklab, var(--brand-primary) 2%, transparent))",
          }}
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
            Commission
            <span className="ml-1.5 text-sm font-semibold normal-case tracking-normal text-foreground tabular-nums">
              {commissionPct}%
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-brand">
            View details
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </button>
  );
}
