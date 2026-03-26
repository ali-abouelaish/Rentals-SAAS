"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type State = { ok?: boolean; error?: string };

export async function submitCardEnquiry(
  _prev: State,
  formData: FormData
): Promise<State> {
  const agentId  = formData.get("agent_id")?.toString();
  const tenantId = formData.get("tenant_id")?.toString();
  const name     = formData.get("name")?.toString()?.trim();
  const phone    = formData.get("phone")?.toString()?.trim();
  const area     = formData.get("pref_area")?.toString()?.trim() || null;
  const budget   = formData.get("budget")?.toString()?.trim() || null;
  const occupation = formData.get("occupation")?.toString()?.trim() || null;

  if (!agentId || !tenantId) return { error: "Invalid enquiry link." };
  if (!name) return { error: "Name is required." };
  if (!phone) return { error: "Phone number is required." };

  const parts: string[] = [];
  if (area)       parts.push(`Preferred area: ${area}`);
  if (budget)     parts.push(`Budget: ${budget}`);
  if (occupation) parts.push(`Occupation: ${occupation}`);
  const messageText = parts.length ? parts.join("\n") : null;

  const messageId = crypto.randomUUID();

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("leads").insert({
    tenant_id:    tenantId,
    message_id:   messageId,
    name,
    email:        `card-${messageId}@noreply.local`,
    telephone:    phone,
    has_phone:    true,
    address:      area,
    message_text: messageText,
    source:       "business_card",
    status:       "new",
    assigned_to:  agentId,
  });

  if (error) return { error: error.message };
  return { ok: true };
}
