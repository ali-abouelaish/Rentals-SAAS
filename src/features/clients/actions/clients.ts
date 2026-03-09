"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clientSchema, type ClientFormValues } from "../domain/schemas";
import { requireUserProfile } from "@/lib/auth/requireRole";

export async function createClient(values: ClientFormValues) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const payload = clientSchema.parse(values);
  const assigned = payload.assigned_agent_id ?? profile.id;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...payload,
      agency_name: payload.agency_name?.trim() || null,
      contact_number: payload.contact_number?.trim() || null,
      share_code: payload.share_code?.trim() || null,
      assigned_agent_id: assigned,
      tenant_id: profile.tenant_id
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "client_created",
    entity_type: "client",
    entity_id: data.id,
    metadata: { full_name: data.full_name }
  });

  revalidatePath("/clients");
  return data;
}

export async function updateClient(id: string, values: ClientFormValues) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const payload = clientSchema.parse(values);

  const { data, error } = await supabase
    .from("clients")
    .update({
      ...payload,
      agency_name: payload.agency_name?.trim() || null,
      contact_number: payload.contact_number?.trim() || null,
      share_code: payload.share_code?.trim() || null
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "client_updated",
    entity_type: "client",
    entity_id: data.id,
    metadata: { full_name: data.full_name }
  });

  revalidatePath(`/clients/${id}`);
  return data;
}

const CLIENT_STATUSES = ["pending", "on_hold", "solved", "registered"] as const;

export async function updateClientStatus(clientId: string, status: string) {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();
  if (!CLIENT_STATUSES.includes(status as (typeof CLIENT_STATUSES)[number])) {
    throw new Error("Invalid status");
  }

  const { data, error } = await supabase
    .from("clients")
    .update({ status })
    .eq("id", clientId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return data;
}
