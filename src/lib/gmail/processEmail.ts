import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type GmailMessage } from "./apiClient";
import { getExtractor } from "./extractors";

export type ProcessEmailResult =
  | { action: "created"; leadId: string }
  | { action: "skip"; reason: "unknown_sender" | "duplicate" | "no_extractor" | "parse_failed" };

export async function processEmail(
  message: GmailMessage,
  tenantId: string
): Promise<ProcessEmailResult> {
  const admin = createSupabaseAdminClient();

  // 1. Sender domain check — look up tenant's active platform configs
  const senderDomain = extractDomain(message.from);
  const { data: platformConfigs } = await admin
    .from("tenant_platform_configs")
    .select("platform_name, sender_domain")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const matchedPlatform = (platformConfigs ?? []).find((c) =>
    senderDomain.includes(c.sender_domain.toLowerCase())
  );

  if (!matchedPlatform) {
    return { action: "skip", reason: "unknown_sender" };
  }

  // 2. Duplicate check (cheap DB query before any parsing)
  const { data: existing } = await admin
    .from("leads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("message_id", message.messageId)
    .maybeSingle();

  if (existing) {
    return { action: "skip", reason: "duplicate" };
  }

  // 3. Get the platform-specific extractor
  const extractor = getExtractor(matchedPlatform.platform_name);
  if (!extractor) {
    return { action: "skip", reason: "no_extractor" };
  }

  // 4. Run extractor
  let leadData;
  try {
    leadData = extractor(message.body);
  } catch (err) {
    await logParseError(admin, tenantId, message.messageId, err);
    return { action: "skip", reason: "parse_failed" };
  }

  if (!leadData) {
    await logParseError(admin, tenantId, message.messageId, new Error("Extractor returned null"));
    return { action: "skip", reason: "parse_failed" };
  }

  // 5. Listing match — try property_ref first, then property_url
  let listingId: string | null = null;

  if (leadData.property_ref) {
    const { data: byRef } = await admin
      .from("scraped_listings")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("title", `%${leadData.property_ref}%`)
      .maybeSingle();
    listingId = byRef?.id ?? null;
  }

  if (!listingId && leadData.property_url) {
    const { data: byUrl } = await admin
      .from("scraped_listings")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("url", `%${leadData.property_url}%`)
      .maybeSingle();
    listingId = byUrl?.id ?? null;
  }

  // 6. Persist lead
  const { data: inserted, error } = await admin
    .from("leads")
    .insert({
      tenant_id: tenantId,
      message_id: message.messageId,
      name: leadData.name,
      email: leadData.email,
      telephone: leadData.telephone,
      telephone_clean: leadData.telephone_clean,
      address: leadData.address,
      full_address: leadData.full_address,
      property_ref: leadData.property_ref,
      property_url: leadData.property_url,
      message_text: leadData.message_text,
      source: matchedPlatform.platform_name,
      status: "new",
      listing_id: listingId,
      assigned_to: null,
      is_hot: leadData.is_hot,
      has_phone: leadData.has_phone,
      raw_body: message.body,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to insert lead: ${error.message}`);

  return { action: "created", leadId: inserted.id };
}

function extractDomain(from: string): string {
  const match = from.match(/@([\w.\-]+)/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
}

async function logParseError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  tenantId: string,
  messageId: string,
  err: unknown
) {
  try {
    await admin.from("activity_log").insert({
      tenant_id: tenantId,
      actor_user_id: null,
      action: "lead_parse_failed",
      entity_type: "lead",
      entity_id: null,
      metadata: {
        message_id: messageId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  } catch {
    // best-effort logging
  }
}
