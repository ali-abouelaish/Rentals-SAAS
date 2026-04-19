"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

export async function getRoomBookingLink(unitId: string): Promise<{ url: string } | { error: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Confirm unit belongs to this tenant
  const { data: unit } = await supabase
    .from("units")
    .select("id")
    .eq("id", unitId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!unit) return { error: "Unit not found" };

  const { data: form } = await supabase
    .from("booking_forms")
    .select("public_slug")
    .eq("tenant_id", profile.tenant_id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!form) {
    return { error: "No active booking form. Create one in Settings → Booking forms." };
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return { url: `${appUrl}/apply/${form.public_slug}/${unitId}` };
}
