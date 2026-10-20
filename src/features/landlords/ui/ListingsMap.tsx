"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./listings-map.css";
import { formatGBP } from "@/lib/utils/formatters";
import { formatAge } from "@/lib/utils/freshness";
import type { ListingMapPoint } from "../domain/types";

// One place to swap tile providers. OSM's own tiles need no key but carry no
// SLA and require this attribution; a keyed provider is a drop-in replacement.
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const FIT_OPTIONS = { padding: [32, 32] as [number, number], maxZoom: 15 };

type PinGroup = { key: string; lat: number; lng: number; listings: ListingMapPoint[] };

/**
 * SpareRoom often pins every ad in a building to one point, which would stack
 * markers so only the top one is clickable. One pin per point, listing them all.
 */
function groupByPosition(points: ListingMapPoint[]): PinGroup[] {
  const groups = new Map<string, PinGroup>();
  for (const point of points) {
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    const group = groups.get(key);
    if (group) group.listings.push(point);
    else groups.set(key, { key, lat: point.lat, lng: point.lng, listings: [point] });
  }
  return Array.from(groups.values());
}

/**
 * Trackpad pinch zooms the map; two-finger scrolling still scrolls the page.
 *
 * Browsers deliver a trackpad pinch as a `wheel` event with ctrlKey set (as is
 * Ctrl + mouse wheel), so this lets only those through to Leaflet's wheel-zoom
 * handler. A capture listener on the container runs before Leaflet's own
 * listener there, and stopping a plain scroll leaves its default — scrolling
 * the page — intact, so the page can never get trapped under the map.
 */
function PinchZoomOnly() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) e.stopImmediatePropagation();
    };
    container.addEventListener("wheel", onWheel, { capture: true });
    return () => container.removeEventListener("wheel", onWheel, { capture: true });
  }, [map]);
  return null;
}

/** Refit when the points change without the map remounting. */
function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, FIT_OPTIONS);
  }, [map, bounds]);
  return null;
}

export default function ListingsMap({
  points,
  showLandlord,
}: {
  points: ListingMapPoint[];
  /** Name and link the landlord in each popup; off on their own page. */
  showLandlord: boolean;
}) {
  const groups = useMemo(() => groupByPosition(points), [points]);
  const bounds = useMemo<LatLngBoundsExpression>(
    () => groups.map((g) => [g.lat, g.lng] as [number, number]),
    [groups]
  );

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={FIT_OPTIONS}
      // Wheel zoom is on, but PinchZoomOnly filters it down to trackpad pinch
      // and Ctrl + wheel.
      scrollWheelZoom
      // Leaflet snaps wheel zoom up to a whole level per 40ms burst, which
      // turns one pinch into a dozen levels; quarter steps keep it smooth.
      zoomSnap={0.25}
      className="listings-map h-full w-full"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <PinchZoomOnly />
      <FitBounds bounds={bounds} />
      {groups.map((group) => (
        <CircleMarker
          key={group.key}
          center={[group.lat, group.lng]}
          radius={group.listings.length > 1 ? 9 : 7}
          // Colour via class, not Leaflet's `color`: Leaflet writes SVG
          // attributes, where the tenant's `var(--brand-primary)` won't resolve.
          pathOptions={{ className: "fill-brand stroke-white", weight: 2, fillOpacity: 0.9 }}
        >
          {/* Sized for the phone map (~270 x 280 at 360px wide): content plus
              Leaflet's margins and tip must fit inside it, or autoPan can
              never bring the whole popup into view. */}
          <Popup maxWidth={220} maxHeight={220}>
            <div className="space-y-3">
              {group.listings.map((listing) => (
                <div key={listing.id} className="space-y-0.5">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {listing.title ?? "Untitled listing"}
                  </p>
                  <p className="text-xs text-foreground-secondary">
                    {listing.priceGbp != null
                      ? `${listing.fromPrice ? "From " : ""}${formatGBP(listing.priceGbp)} pcm`
                      : "Price not listed"}
                    {" · "}seen {formatAge(listing.lastSeenAt).toLowerCase()}
                  </p>
                  <div className="flex flex-wrap gap-x-3 text-xs">
                    {showLandlord && listing.landlordId && (
                      <Link href={`/landlords/${listing.landlordId}`} className="font-medium hover:underline">
                        {listing.landlordName ?? "Landlord"}
                      </Link>
                    )}
                    {listing.url && (
                      <a href={listing.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                        View advert
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
