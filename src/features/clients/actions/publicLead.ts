"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clientSchema } from "../domain/schemas";

const rateLimitMap = new Map<string, { count: number; lastAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_MINUTE = 5;

export async function createPublicLead(formData: FormData) {
  const agentId = String(formData.get("agent_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");

  const payload = clientSchema.parse({
    full_name: String(formData.get("full_name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    nationality: String(formData.get("nationality") ?? ""),
    current_address: String(formData.get("current_address") ?? ""),
    status: "pending",
    assigned_agent_id: agentId
  });

  const key = `${agentId}-${tenantId}`;
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now - record.lastAt > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, lastAt: now });
  } else {
    if (record.count >= MAX_PER_MINUTE) {
      return { error: "Please wait a minute before submitting again." };
    }
    record.count += 1;
    record.lastAt = now;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...payload,
      tenant_id: tenantId
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("activity_log").insert({
    tenant_id: tenantId,
    actor_user_id: null,
    action: "client_lead_created",
    entity_type: "client",
    entity_id: data.id,
    metadata: { full_name: payload.full_name }
  });

  return { ok: true };
}
