"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { buildTenantAppUrl } from "@/lib/urls";

export type RoomBookingLinkResult =
  | { url: string }
  | {
      error: string;
      reason: "no_portfolio" | "no_form_for_portfolio" | "unit_not_found";
      portfolioId?: string;
      portfolioName?: string;
    };

export async function getRoomBookingLink(unitId: string): Promise<RoomBookingLinkResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: unit } = await supabase
    .from("units")
    .select("id, property:properties(portfolio_id, portfolio:portfolios(id, name))")
    .eq("id", unitId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle<{
      id: string;
      property: {
        portfolio_id: string | null;
        portfolio: { id: string; name: string } | null;
      } | null;
    }>();

  if (!unit) return { error: "Unit not found", reason: "unit_not_found" };

  const portfolioId = unit.property?.portfolio_id ?? null;
  const portfolioName = unit.property?.portfolio?.name ?? null;

  if (!portfolioId) {
    return {
      error: "This unit's property isn't assigned to a portfolio yet.",
      reason: "no_portfolio",
    };
  }

  const { data: form } = await supabase
    .from("booking_forms")
    .select("public_slug")
    .eq("tenant_id", profile.tenant_id)
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!form) {
    return {
      error: portfolioName
        ? `No active booking form for the "${portfolioName}" portfolio yet.`
        : "No active booking form for this portfolio yet.",
      reason: "no_form_for_portfolio",
      portfolioId,
      portfolioName: portfolioName ?? undefined,
    };
  }

  const appUrl = buildTenantAppUrl(headers());
  return { url: `${appUrl}/apply/${form.public_slug}/${unitId}` };
}
