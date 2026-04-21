"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import { motion } from "framer-motion";
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

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

const inputCls =
  "h-11 w-full rounded-2xl border border-border bg-surface-card px-4 text-sm text-foreground placeholder:text-foreground-muted shadow-xs transition focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

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
      <div className="rounded-3xl border border-dashed border-border bg-surface-card p-12 text-center shadow-sm">
        <p
          className="text-[1.35rem] leading-[1.15] tracking-[-0.01em] text-foreground"
          style={{ ...SERIF, fontWeight: 500 }}
        >
          No units currently match this share.
        </p>
        <p className="mt-2 text-sm text-foreground-secondary">Check back soon.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
      className="space-y-6"
    >
      {/* ── Filter panel ── */}
      <section>
        <div className="mb-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-secondary backdrop-blur">
            <SlidersHorizontal className="h-3 w-3 text-brand" />
            Refine the list
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:flex lg:flex-wrap lg:items-end lg:gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Postcode or area"
                    className={`${inputCls} pl-10 sm:w-72`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-[0.14em] text-foreground-muted">
                  Monthly rent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Min £"
                    className={`${inputCls} w-28`}
                  />
                  <span className="text-foreground-muted">—</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Max £"
                    className={`${inputCls} w-28`}
                  />
                </div>
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                  className="inline-flex h-11 items-center gap-1.5 self-end rounded-2xl border border-border bg-surface-card px-4 text-sm font-medium text-foreground-secondary shadow-xs transition hover:border-brand/40 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>

            <div className="inline-flex self-start rounded-2xl border border-border bg-surface-inset/50 p-1 lg:self-end">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-all",
                  view === "grid"
                    ? "bg-surface-card text-foreground shadow-xs"
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
                  "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-all",
                  view === "table"
                    ? "bg-surface-card text-foreground shadow-xs"
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
            <p className="mt-4 text-xs text-foreground-secondary">
              Showing{" "}
              <span className="font-medium text-foreground tabular-nums">
                {filteredUnits.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground tabular-nums">{units.length}</span>{" "}
              unit{units.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </section>

      {filteredUnits.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface-card p-12 text-center shadow-sm">
          <p
            className="text-[1.35rem] leading-[1.15] tracking-[-0.01em] text-foreground"
            style={{ ...SERIF, fontWeight: 500 }}
          >
            No units match these filters.
          </p>
          <p className="mt-2 text-sm text-foreground-secondary">Try widening your search.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUnits.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: Math.min(i * 0.04, 0.3),
                ease: [0.22, 0.61, 0.36, 1],
              }}
            >
              <UnitCard unit={u} commissionPct={commissionPct} onOpenInfo={setInfoUnit} />
            </motion.div>
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
    </motion.div>
  );
}
