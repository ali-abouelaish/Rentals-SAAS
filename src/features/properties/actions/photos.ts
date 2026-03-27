"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { UnitPhoto } from "../domain/types";

const BUCKET = "property_photos";

interface SavePhotoParams {
  url: string;
  category: UnitPhoto["category"];
  unit_id?: string | null;
  property_id?: string | null;
  sort_order?: number;
}

export async function saveUnitPhoto(params: SavePhotoParams): Promise<UnitPhoto> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("unit_photos")
    .insert({
      url: params.url,
      category: params.category,
      unit_id: params.unit_id ?? null,
      property_id: params.property_id ?? null,
      sort_order: params.sort_order ?? 0,
      tenant_id: profile.tenant_id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as UnitPhoto;
}

export async function deleteUnitPhoto(id: string): Promise<void> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Fetch the row to get the URL for storage deletion
  const { data: photo, error: fetchError } = await supabase
    .from("unit_photos")
    .select("url")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (fetchError || !photo) return;

  // Derive storage path from public URL: everything after "/property_photos/"
  const marker = `/${BUCKET}/`;
  const markerIdx = photo.url.indexOf(marker);
  if (markerIdx !== -1) {
    const storagePath = photo.url.slice(markerIdx + marker.length).split("?")[0];
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  // Delete the DB row
  await supabase
    .from("unit_photos")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
}
