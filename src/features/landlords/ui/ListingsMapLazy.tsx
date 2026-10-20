"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Leaflet reads `window` the moment it is imported, so the map can only render
 * in the browser — and Next 14 only allows `ssr: false` from a client module.
 */
export const ListingsMapLazy = dynamic(() => import("./ListingsMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});
