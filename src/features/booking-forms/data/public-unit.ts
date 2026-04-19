import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicUnitForBooking = {
  id: string;
  tenant_id: string;
  room_number: string | null;
  room_type: string | null;
  unit_type: "room" | "studio" | "whole_flat";
  status: string;
  min_price_pcm: number | null;
  max_price_pcm: number | null;
  holding_deposit: number | null;
  available_date: string | null;
  property: {
    id: string;
    name: string;
    address_line_1: string;
    address_line_2: string | null;
    postcode: string | null;
    area: string | null;
  } | null;
};

// Public — no auth. Scoped by tenant_id that the caller already resolved
// server-side from the form slug, so we don't trust anything user-supplied.
export async function getPublicUnitForBooking(
  tenantId: string,
  unitId: string
): Promise<PublicUnitForBooking | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("units")
    .select(
      "id, tenant_id, room_number, room_type, unit_type, status, min_price_pcm, max_price_pcm, holding_deposit, available_date, property:properties(id, name, address_line_1, address_line_2, postcode, area)"
    )
    .eq("id", unitId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as PublicUnitForBooking;
}
