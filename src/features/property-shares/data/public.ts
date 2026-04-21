import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PropertyShare } from "../domain/types";

export type PublicShareUnit = {
  id: string;
  unit_type: string;
  room_number: string | null;
  room_type: string | null;
  status: string;
  notice_given: boolean;
  available_date: string | null;
  min_price_pcm: number | null;
  max_price_pcm: number | null;
  couples_allowed: boolean;
  couples_price_pcm: number | null;
  notes: string | null;
  property: {
    id: string;
    name: string;
    address_line_1: string;
    address_line_2: string | null;
    postcode: string | null;
    area: string | null;
    notes: string | null;
  };
  contact: {
    full_name: string;
    phone: string | null;
    email: string | null;
    whatsapp_number: string | null;
  } | null;
  photos: Array<{ id: string; url: string; sort_order: number; scope: "unit" | "property" }>;
};

export type PublicShareResult = {
  share: PropertyShare;
  units: PublicShareUnit[];
};

export async function getPublicShareByToken(token: string): Promise<PropertyShare | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("property_shares")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return data as PropertyShare;
}

export type PublicShareBrandContext = {
  tenant_slug: string;
  tenant_name: string;
  brand_name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
};

export async function getPublicShareBrandContext(
  token: string
): Promise<PublicShareBrandContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("property_shares")
    .select(
      "tenant:tenants(slug, name, branding:tenant_branding_settings(brand_name, logo_url, primary_color, secondary_color, accent_color))"
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;

  const tenant = (Array.isArray((data as any).tenant) ? (data as any).tenant[0] : (data as any).tenant) as
    | {
        slug: string;
        name: string;
        branding:
          | {
              brand_name: string | null;
              logo_url: string | null;
              primary_color: string | null;
              secondary_color: string | null;
              accent_color: string | null;
            }
          | Array<any>
          | null;
      }
    | null;

  if (!tenant) return null;

  const branding = (Array.isArray(tenant.branding) ? tenant.branding[0] : tenant.branding) ?? null;

  return {
    tenant_slug: tenant.slug,
    tenant_name: tenant.name,
    brand_name: branding?.brand_name ?? tenant.name,
    logo_url: branding?.logo_url ?? null,
    primary_color: branding?.primary_color ?? null,
    secondary_color: branding?.secondary_color ?? null,
    accent_color: branding?.accent_color ?? null,
  };
}

export async function getPublicShareUnits(share: PropertyShare): Promise<PublicShareUnit[]> {
  const supabase = createSupabaseAdminClient();

  let scopedPropertyIds: string[] | null = null;
  if (share.portfolio_id) {
    const { data: portfolioProps, error: pErr } = await supabase
      .from("properties")
      .select("id")
      .eq("tenant_id", share.tenant_id)
      .eq("portfolio_id", share.portfolio_id);
    if (pErr) return [];
    scopedPropertyIds = (portfolioProps ?? []).map((p: any) => p.id);
    if (scopedPropertyIds.length === 0) return [];
  } else if (share.property_ids && share.property_ids.length > 0) {
    scopedPropertyIds = share.property_ids;
  }

  let query = supabase
    .from("units")
    .select(
      `
      id, unit_type, room_number, room_type, status, notice_given, available_date,
      min_price_pcm, max_price_pcm, couples_allowed, couples_price_pcm, notes, pm_tenant_id, resident_id,
      property:properties!inner (
        id, name, address_line_1, address_line_2, postcode, area, notes
      )
    `
    )
    .eq("tenant_id", share.tenant_id)
    .in("status", share.availability_statuses);

  if (scopedPropertyIds !== null) {
    query = query.in("property_id", scopedPropertyIds);
  }

  const { data: unitsRaw, error } = await query
    .order("available_date", { ascending: true, nullsFirst: true })
    .order("min_price_pcm", { ascending: true, nullsFirst: false });

  if (error || !unitsRaw || unitsRaw.length === 0) return [];

  const unitIds = unitsRaw.map((u: any) => u.id);
  const propertyIds = Array.from(new Set(unitsRaw.map((u: any) => u.property?.id).filter(Boolean)));
  const pmTenantIds = unitsRaw.map((u: any) => u.pm_tenant_id).filter(Boolean);
  const residentIds = unitsRaw.map((u: any) => u.resident_id).filter(Boolean);

  const [photosRes, pmTenantsRes, residentsRes] = await Promise.all([
    supabase
      .from("unit_photos")
      .select("id, url, sort_order, unit_id, property_id")
      .eq("tenant_id", share.tenant_id)
      .or(
        `unit_id.in.(${unitIds.join(",")})${propertyIds.length ? `,property_id.in.(${propertyIds.join(",")})` : ""}`
      )
      .order("sort_order", { ascending: true }),
    pmTenantIds.length > 0
      ? supabase
          .from("pm_tenants")
          .select("id, full_name, phone, email, whatsapp_number")
          .eq("tenant_id", share.tenant_id)
          .in("id", pmTenantIds)
      : Promise.resolve({ data: [], error: null }),
    residentIds.length > 0
      ? supabase
          .from("property_residents")
          .select("id, full_name, phone, email")
          .eq("tenant_id", share.tenant_id)
          .in("id", residentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const photosByUnit = new Map<string, PublicShareUnit["photos"]>();
  const photosByProperty = new Map<string, PublicShareUnit["photos"]>();
  for (const p of (photosRes.data ?? []) as any[]) {
    const entry = { id: p.id, url: p.url, sort_order: p.sort_order, scope: (p.unit_id ? "unit" : "property") as "unit" | "property" };
    if (p.unit_id) {
      const arr = photosByUnit.get(p.unit_id) ?? [];
      arr.push(entry);
      photosByUnit.set(p.unit_id, arr);
    } else if (p.property_id) {
      const arr = photosByProperty.get(p.property_id) ?? [];
      arr.push(entry);
      photosByProperty.set(p.property_id, arr);
    }
  }

  const pmTenantsById = new Map<string, any>();
  for (const t of (pmTenantsRes.data ?? []) as any[]) pmTenantsById.set(t.id, t);
  const residentsById = new Map<string, any>();
  for (const r of (residentsRes.data ?? []) as any[]) residentsById.set(r.id, r);

  return unitsRaw.map((u: any): PublicShareUnit => {
    const unitPhotos = photosByUnit.get(u.id) ?? [];
    const propertyPhotos = u.property?.id ? photosByProperty.get(u.property.id) ?? [] : [];
    const photos = [...unitPhotos, ...propertyPhotos];

    let contact: PublicShareUnit["contact"] = null;
    if (u.pm_tenant_id && pmTenantsById.has(u.pm_tenant_id)) {
      const t = pmTenantsById.get(u.pm_tenant_id);
      contact = {
        full_name: t.full_name,
        phone: t.phone ?? null,
        email: t.email ?? null,
        whatsapp_number: t.whatsapp_number ?? null,
      };
    } else if (u.resident_id && residentsById.has(u.resident_id)) {
      const r = residentsById.get(u.resident_id);
      contact = {
        full_name: r.full_name,
        phone: r.phone ?? null,
        email: r.email ?? null,
        whatsapp_number: null,
      };
    }

    return {
      id: u.id,
      unit_type: u.unit_type,
      room_number: u.room_number,
      room_type: u.room_type,
      status: u.status,
      notice_given: u.notice_given,
      available_date: u.available_date,
      min_price_pcm: u.min_price_pcm,
      max_price_pcm: u.max_price_pcm,
      couples_allowed: u.couples_allowed,
      couples_price_pcm: u.couples_price_pcm,
      notes: u.notes,
      property: u.property,
      contact,
      photos,
    };
  });
}
