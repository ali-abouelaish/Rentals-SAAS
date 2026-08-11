// Template reads + lazy default seeding. Seeding runs on first visit to the
// templates page or automations page (upsert, on conflict do nothing), so
// tenants created after this feature ships get defaults without a backfill.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TEMPLATES } from "../domain/defaultTemplates";
import type { MessageTemplateRow } from "../domain/types";

export async function ensureDefaultTemplates(tenantId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("message_templates").upsert(
    DEFAULT_TEMPLATES.map((t) => ({
      tenant_id: tenantId,
      key: t.key,
      name: t.name,
      channel: t.channel,
      entity_type: t.entityType,
      subject: t.subject,
      body: t.body,
      is_default: true,
    })),
    { onConflict: "tenant_id,key,channel", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}

export async function listTemplates(tenantId: string): Promise<MessageTemplateRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("message_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("entity_type", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageTemplateRow[];
}
