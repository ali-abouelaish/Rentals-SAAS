"use client";

import Image from "next/image";
import { Home, Images } from "lucide-react";
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
  const hero = unit.photos[0]?.url ?? null;
  const avail = availabilityLabel(unit);
  const fullAddress = [unit.property.address_line_1, unit.property.address_line_2]
    .filter(Boolean)
    .join(", ");

  const toneClass =
    avail.tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : avail.tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-700";

  const label = unitLabel(unit);
  const hasPhotos = unit.photos.length > 0;
  const priceRange = formatPriceRange(unit.min_price_pcm, unit.max_price_pcm);

  return (
    <button
      type="button"
      onClick={() => onOpenInfo(unit)}
      className="group text-left rounded-2xl border border-border bg-surface-card overflow-hidden shadow-sm hover:shadow-md hover:border-brand/40 transition-all focus:outline-none focus:ring-2 focus:ring-brand"
    >
      <div className="relative block w-full aspect-[4/3] bg-surface-inset overflow-hidden">
        {hero ? (
          <Image
            src={hero}
            alt={`${unit.property.name} - ${label}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-foreground-muted">
            <Home className="h-10 w-10" />
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium ${toneClass}`}
        >
          {avail.label}
        </span>
        {hasPhotos && unit.photos.length > 1 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
            <Images className="h-3 w-3" />
            {unit.photos.length}
          </span>
        )}
      </div>

      <div className="p-5 space-y-3">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{unit.property.name}</h3>
              <p className="text-sm text-foreground-muted truncate">{label}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold text-foreground tabular-nums">{priceRange}</p>
              {unit.couples_allowed && unit.couples_price_pcm && (
                <p className="text-xs text-foreground-muted tabular-nums">
                  Couples £{unit.couples_price_pcm.toLocaleString("en-GB")}
                </p>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm text-foreground-muted truncate">
            {fullAddress}
            {unit.property.postcode ? ` · ${unit.property.postcode}` : ""}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-surface-inset px-3 py-2 text-sm">
          <span className="text-foreground-muted">
            Commission <span className="font-medium text-foreground">{commissionPct}%</span>
          </span>
          <span className="text-xs font-medium text-brand">View details →</span>
        </div>
      </div>
    </button>
  );
}
