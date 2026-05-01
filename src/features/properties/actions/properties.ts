"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { propertySchema, propertyEditSchema, type PropertyFormValues } from "../domain/schemas";

export async function createProperty(values: PropertyFormValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = propertySchema.parse(values);

  const { data: property, error } = await supabase
    .from("properties")
    .insert({ ...payload, tenant_id: profile.tenant_id })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (property.property_type === "hmo") {
    // Auto-create N room units from total_rooms
    const count = payload.total_rooms ?? 0;
    if (count > 0) {
      const rooms = Array.from({ length: count }, () => ({
        tenant_id: profile.tenant_id,
        property_id: property.id,
        unit_type: "room" as const,
        status: "available" as const,
        furnishings: (payload.furnished ? "furnished" : "unfurnished") as "furnished" | "unfurnished",
      }));
      await supabase.from("units").insert(rooms);
    }
  } else {
    // Auto-create one unit for studio/whole_flat
    const unitType = property.property_type as "studio" | "whole_flat";
    await supabase.from("units").insert({
      tenant_id: profile.tenant_id,
      property_id: property.id,
      unit_type: unitType,
      status: "available",
      furnishings: payload.furnished ? "furnished" : "unfurnished",
    });
  }

  revalidatePath("/properties");
  return property;
}

export async function updateProperty(id: string, values: Partial<PropertyFormValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  // Edit path: no validations, all fields nullable; null/undefined values are
  // dropped so existing DB values are preserved when the user leaves a field blank.
  const parsed = propertyEditSchema.parse(values);
  const payload = Object.fromEntries(
    Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined)
  );

  const { data, error } = await supabase
    .from("properties")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  return data;
}

export async function deleteProperty(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
}
