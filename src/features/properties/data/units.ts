import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Unit, UnitFilters, UnitStatus, UnitType, RoomType } from "../domain/types";

const UNIT_SELECT = `
  *,
  property:properties(
    *,
    portfolio:portfolios(id, name, color)
  ),
  resident:property_residents(*)
` as const;

export type UnitsResult = {
  units: Unit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getUnits(
  filters: Partial<UnitFilters> = {},
  page = 1,
  pageSize = 50
): Promise<UnitsResult> {
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("units")
    .select(UNIT_SELECT, { count: "exact" })
    .order("created_at", { ascending: true });

  // Search — unit number, property address, resident name
  if (filters.search?.trim()) {
    const s = `%${filters.search.trim()}%`;
    query = query.or(
      `room_number.ilike.${s},property_id.in.(select id from properties where address_line_1 ilike '${s}')`
    );
  }

  // Status filter
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in("status", filters.statuses as UnitStatus[]);
  }

  // Unit type filter
  if (filters.unitTypes && filters.unitTypes.length > 0) {
    query = query.in("unit_type", filters.unitTypes as UnitType[]);
  }

  // Room type filter
  if (filters.roomTypes && filters.roomTypes.length > 0) {
    query = query.in("room_type", filters.roomTypes as RoomType[]);
  }

  // Available date range
  if (filters.availableFrom) {
    query = query.gte("available_date", filters.availableFrom);
  }
  if (filters.availableTo) {
    query = query.lte("available_date", filters.availableTo);
  }

  // Price range
  if (filters.minPrice) {
    query = query.gte("max_price_pcm", parseInt(filters.minPrice));
  }
  if (filters.maxPrice) {
    query = query.lte("min_price_pcm", parseInt(filters.maxPrice));
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    units: (data ?? []) as Unit[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getUnitById(id: string): Promise<Unit | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("units")
    .select(UNIT_SELECT)
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Unit;
}

export async function getUnitsByProperty(propertyId: string): Promise<Unit[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("units")
    .select(UNIT_SELECT)
    .eq("property_id", propertyId)
    .order("room_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Unit[];
}
