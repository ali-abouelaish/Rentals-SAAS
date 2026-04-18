"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import {
  ownerLandlordSchema,
  propertyManagerSchema,
  type OwnerLandlordFormValues,
  type PropertyManagerFormValues,
} from "../domain/schemas";
import type { OwnerLandlord, PropertyManager } from "../domain/types";

export async function createOwnerLandlord(
  values: OwnerLandlordFormValues
): Promise<OwnerLandlord> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = ownerLandlordSchema.parse(values);

  const { data, error } = await supabase
    .from("owner_landlords")
    .insert({ ...payload, tenant_id: profile.tenant_id })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  return data;
}

export async function updateOwnerLandlord(
  id: string,
  values: Partial<OwnerLandlordFormValues>
): Promise<OwnerLandlord> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("owner_landlords")
    .update(values)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  return data;
}

export async function createPropertyManager(
  values: PropertyManagerFormValues
): Promise<PropertyManager> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = propertyManagerSchema.parse(values);

  const { data, error } = await supabase
    .from("manager_landlords")
    .insert({ ...payload, tenant_id: profile.tenant_id })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  return data;
}

export async function updatePropertyManager(
  id: string,
  values: Partial<PropertyManagerFormValues>
): Promise<PropertyManager> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("manager_landlords")
    .update(values)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  return data;
}

