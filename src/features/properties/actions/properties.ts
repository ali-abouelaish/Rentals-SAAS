"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { propertySchema, type PropertyFormValues } from "../domain/schemas";

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

  // Auto-create one unit for studio/whole_flat
  if (property.property_type !== "hmo") {
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

  const { data, error } = await supabase
    .from("properties")
    .update({ ...values, updated_at: new Date().toISOString() })
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
