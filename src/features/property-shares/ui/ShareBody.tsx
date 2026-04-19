"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Rows3, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { UnitCard } from "./UnitCard";
import { UnitsTableView } from "./UnitsTableView";
import { UnitInfoDrawer } from "./UnitInfoDrawer";
import { Lightbox } from "./Lightbox";
import { unitLabel } from "./format";
import type { PublicShareUnit } from "../data/public";

type ViewMode = "grid" | "table";

interface ShareBodyProps {
  units: PublicShareUnit[];
  commissionPct: number;
  token: string;
}

export function ShareBody({ units, commissionPct, token }: ShareBodyProps) {
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [infoUnit, setInfoUnit] = useState<PublicShareUnit | null>(null);
  const [galleryUnit, setGalleryUnit] = useState<PublicShareUnit | null>(null);

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);

    return units.filter((u) => {
      if (q) {
        const haystack = [
          u.property.postcode,
          u.property.area,
          u.property.name,
          u.property.address_line_1,
          u.property.address_line_2,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (min !== null && !Number.isNaN(min)) {
        if (u.min_price_pcm == null || u.min_price_pcm < min) return false;
      }
      if (max !== null && !Number.isNaN(max)) {
        if (u.min_price_pcm == null || u.min_price_pcm > max) return false;
      }
      return true;
    });
  }, [units, search, minPrice, maxPrice]);

  const hasFilters = search !== "" || minPrice !== "" || maxPrice !== "";

  if (units.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-card p-12 text-center">
        <p className="text-lg font-medium text-foreground">No units currently match this share.</p>
        <p className="mt-2 text-muted-foreground">Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search postcode or area"
              className="w-64 rounded-lg border border-border bg-surface-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min £"
              className="w-24 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max £"
              className="w-24 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setMinPrice("");
                setMaxPrice("");
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        <div className="inline-flex rounded-lg border border-border bg-surface-card p-1">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "grid"
                ? "bg-brand/10 text-brand"
                : "text-foreground-muted hover:text-foreground"
            )}
            aria-pressed={view === "grid"}
          >
            <LayoutGrid className="h-4 w-4" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "table"
                ? "bg-brand/10 text-brand"
                : "text-foreground-muted hover:text-foreground"
            )}
            aria-pressed={view === "table"}
          >
            <Rows3 className="h-4 w-4" />
            Table
          </button>
        </div>
      </div>

      {hasFilters && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredUnits.length} of {units.length} unit{units.length === 1 ? "" : "s"}
        </p>
      )}

      {filteredUnits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-card p-12 text-center">
          <p className="text-lg font-medium text-foreground">No units match these filters.</p>
          <p className="mt-2 text-muted-foreground">Try widening your search.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUnits.map((u) => (
            <UnitCard
              key={u.id}
              unit={u}
              commissionPct={commissionPct}
              onOpenInfo={setInfoUnit}
            />
          ))}
        </div>
      ) : (
        <UnitsTableView
          units={filteredUnits}
          commissionPct={commissionPct}
          onOpenInfo={setInfoUnit}
        />
      )}

      <UnitInfoDrawer
        unit={infoUnit}
        commissionPct={commissionPct}
        token={token}
        open={infoUnit !== null}
        onOpenChange={(o) => {
          if (!o) setInfoUnit(null);
        }}
        onOpenGallery={() => {
          if (infoUnit) setGalleryUnit(infoUnit);
        }}
      />

      <Lightbox
        photos={(galleryUnit?.photos ?? []).map((p) => ({ id: p.id, url: p.url }))}
        open={galleryUnit !== null}
        initialIndex={0}
        onClose={() => setGalleryUnit(null)}
        postcode={galleryUnit?.property.postcode ?? null}
        unitLabel={
          galleryUnit ? `${galleryUnit.property.name}-${unitLabel(galleryUnit)}` : ""
        }
        zipUrl={
          galleryUnit && galleryUnit.photos.length > 0
            ? `/api/shares/${encodeURIComponent(token)}/units/${galleryUnit.id}/images.zip`
            : undefined
        }
      />
    </div>
  );
}
