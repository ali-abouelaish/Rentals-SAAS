import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListingMapPoint } from "../domain/types";
import { ListingsMapLazy } from "./ListingsMapLazy";

type Variant = "all" | "landlord";

const HEIGHT: Record<Variant, string> = {
  all: "h-[280px] sm:h-[420px]",
  landlord: "h-[280px] sm:h-[320px]",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Map of scraped listings, shared by the landlords list (every landlord) and a
 * landlord's own page (just theirs). Renders no card shell: the list page
 * frames it as a bento card, the detail page nests it in the Listings card.
 */
export function ListingsMapPanel({
  variant,
  points,
  unlocatedCount,
  truncated = false,
  error = null,
  showHeading = true,
  filtered = false,
}: {
  variant: Variant;
  points: ListingMapPoint[];
  unlocatedCount: number;
  truncated?: boolean;
  error?: string | null;
  /** Off when the caller renders its own heading (with filters under it). */
  showHeading?: boolean;
  /** Budget / double-occupancy filters are on, so "nothing" means "no match". */
  filtered?: boolean;
}) {
  if (error) {
    return <p className="text-sm text-error">Couldn&apos;t load the map: {error}</p>;
  }

  // A listing missing from the map must read as missing, not silently absent.
  const unlocatedNote =
    unlocatedCount > 0 ? `${plural(unlocatedCount, "listing")} without a location not shown.` : null;

  if (points.length === 0) {
    // On a landlord's page the caller only renders this when they have
    // listings, so one line saying why there's no map is enough.
    if (variant === "landlord") {
      return unlocatedNote ? <p className="text-xs text-foreground-muted">{unlocatedNote}</p> : null;
    }
    return filtered ? (
      <EmptyState
        icon={MapPin}
        title="No listings match"
        description="Try a higher budget or turn off Double occupancy."
      />
    ) : (
      <EmptyState
        icon={MapPin}
        title="No listings to map yet"
        description="SpareRoom listings appear here once scraped. Spreadsheet listings need latitude and longitude columns."
      />
    );
  }

  const landlordCount = new Set(points.map((p) => p.landlordId)).size;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        {showHeading && <h2 className="text-sm font-semibold text-foreground">Map</h2>}
        <p className="text-xs text-foreground-muted">
          {plural(points.length, "listing")}
          {variant === "all" && ` · ${plural(landlordCount, "landlord")}`}
          {truncated && " (most recent)"}
        </p>
      </div>

      {/* `isolate` keeps Leaflet's z-index 400–1000 panes and controls inside
          this box, so they cannot paint over the app header or open drawers. */}
      <div className={`isolate overflow-hidden rounded-bento border border-border ${HEIGHT[variant]}`}>
        <ListingsMapLazy points={points} showLandlord={variant === "all"} />
      </div>

      {unlocatedNote && <p className="text-xs text-foreground-muted">{unlocatedNote}</p>}
    </div>
  );
}

/** Same footprint as the loaded panel, so the list below does not jump. */
export function ListingsMapPanelSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className={`rounded-bento ${HEIGHT.all}`} />
    </div>
  );
}
