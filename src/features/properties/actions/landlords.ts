"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import {
  ownerLandlordSchema,
  ownerLandlordEditSchema,
  propertyManagerSchema,
  propertyManagerEditSchema,
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

  return data;
}

export async function updateOwnerLandlord(
  id: string,
  values: Partial<OwnerLandlordFormValues>
): Promise<OwnerLandlord> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const parsed = ownerLandlordEditSchema.parse(values);
  const payload = Object.fromEntries(
    Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined)
  );

  const { data, error } = await supabase
    .from("owner_landlords")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

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

  return data;
}

export async function updatePropertyManager(
  id: string,
  values: Partial<PropertyManagerFormValues>
): Promise<PropertyManager> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const parsed = propertyManagerEditSchema.parse(values);
  const payload = Object.fromEntries(
    Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined)
  );

  const { data, error } = await supabase
    .from("manager_landlords")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return data;
}

