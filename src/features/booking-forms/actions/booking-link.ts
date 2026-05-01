"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { buildTenantAppUrl } from "@/lib/urls";

export type BookingLinkForm = {
  id: string;
  name: string;
  public_slug: string;
};

export type RoomBookingLinkResult =
  | {
      forms: BookingLinkForm[];
      minPrice: number | null;
      maxPrice: number | null;
      baseUrl: string;
      unitId: string;
    }
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
    .select("id, min_price_pcm, max_price_pcm, property:properties(portfolio_id, portfolio:portfolios(id, name))")
    .eq("id", unitId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle<{
      id: string;
      min_price_pcm: number | null;
      max_price_pcm: number | null;
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

  const { data: forms } = await supabase
    .from("booking_forms")
    .select("id, name, public_slug, portfolio_id")
    .eq("tenant_id", profile.tenant_id)
    .eq("is_active", true)
    .or(`portfolio_id.eq.${portfolioId},portfolio_id.is.null`)
    .order("created_at", { ascending: true });

  if (!forms || forms.length === 0) {
    return {
      error: portfolioName
        ? `No active booking form for the "${portfolioName}" portfolio yet.`
        : "No active booking form for this portfolio yet.",
      reason: "no_form_for_portfolio",
      portfolioId,
      portfolioName: portfolioName ?? undefined,
    };
  }

  const baseUrl = buildTenantAppUrl(headers());

  return {
    forms: forms.map((f) => ({ id: f.id, name: f.name, public_slug: f.public_slug })),
    minPrice: unit.min_price_pcm ?? null,
    maxPrice: unit.max_price_pcm ?? null,
    baseUrl,
    unitId,
  };
}
