import type { PublicShareUnit } from "../data/public";

export function formatPriceRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Price on request";
  if (min != null && max != null && max > min) {
    return `£${min.toLocaleString("en-GB")} – £${max.toLocaleString("en-GB")} pcm`;
  }
  const value = (min ?? max) as number;
  return `£${value.toLocaleString("en-GB")} pcm`;
}

export function unitLabel(unit: PublicShareUnit): string {
  if (unit.unit_type === "whole_flat") return "Whole flat";
  if (unit.unit_type === "studio") return "Studio";
  const roomNo = unit.room_number ? `Room ${unit.room_number}` : "Room";
  const roomType = unit.room_type ? ` (${unit.room_type})` : "";
  return `${roomNo}${roomType}`;
}
