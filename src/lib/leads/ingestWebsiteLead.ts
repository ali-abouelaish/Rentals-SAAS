import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTelephone, isHotText } from "@/lib/leads/enrich";
import { matchListingForLead } from "@/lib/leads/matchListing";
import {
  normaliseSubmission,
  validateSubmission,
  websiteMessageId,
  type Pair,
  type WebsiteLeadWarning,
} from "@/features/leads/domain/websiteLead";
import { WEBSITE_SOURCE, placeholderEmail } from "@/features/leads/domain/sources";

export type IngestOutcome =
  | { kind: "created"; id: string; warnings: WebsiteLeadWarning[]; redirect: string | null }
  | { kind: "duplicate"; id: string; redirect: string | null }
  | { kind: "test"; lead: Record<string, unknown>; warnings: WebsiteLeadWarning[]; redirect: string | null }
  | { kind: "ignored"; redirect: string | null }
  | { kind: "invalid"; message: string; fields: Record<string, string> };

/** A database failure, carrying only the stage and Postgres code — never row data. */
export class IngestError extends Error {
  constructor(
    readonly stage: string,
    readonly code: string | undefined
  ) {
    super(`website lead ${stage} failed (${code ?? "no code"})`);
  }
}

/**
 * Store one website enquiry as a lead for `tenantId`. The caller has already
 * authenticated the key and checked the tenant's entitlements; the tenant
 * comes from the key, never from the request body.
 *
 * Inserts first and treats a unique violation on (tenant_id, message_id) as
 * the duplicate it is, so two identical requests racing each other still
 * make one lead.
 */
export async function ingestWebsiteLead(input: {
  tenantId: string;
  apiKeyId: string;
  pairs: Pair[];
  filesIgnored?: number;
  now?: Date;
}): Promise<IngestOutcome> {
  const normalised = normaliseSubmission(input.pairs, { filesIgnored: input.filesIgnored });
  const redirect = normalised.redirect;

  // A filled honeypot is a bot. It is answered exactly like a real enquiry.
  if (normalised.honeypot) return { kind: "ignored", redirect };

  const result = validateSubmission(normalised);
  if (!result.ok) return { kind: "invalid", message: result.message, fields: result.fields };

  const { lead } = result;
  const warnings = [...result.warnings];
  const admin = createSupabaseAdminClient();

  const match = await matchListingForLead(admin, input.tenantId, {
    listingId: lead.listing_id,
    propertyRef: lead.property_ref,
    propertyUrl: lead.page_url,
  });
  if (match.explicitRejected) warnings.push("listing_not_found");

  const messageId = websiteMessageId({ apiKeyId: input.apiKeyId, lead, now: input.now ?? new Date() });
  const isHot = isHotText(lead.message_text);

  if (normalised.test) {
    return {
      kind: "test",
      redirect,
      warnings,
      lead: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        message_text: lead.message_text,
        property_ref: lead.property_ref,
        property_address: lead.property_address,
        page_url: lead.page_url,
        listing_id: match.listingId,
        external_id: lead.external_id,
        is_hot: isHot,
      },
    };
  }

  const { data, error } = await admin
    .from("leads")
    .insert({
      tenant_id: input.tenantId,
      message_id: messageId,
      name: lead.name,
      email: lead.email ?? placeholderEmail("web", randomUUID()),
      telephone: lead.phone,
      telephone_clean: cleanTelephone(lead.phone),
      has_phone: Boolean(lead.phone),
      address: lead.property_address,
      property_ref: lead.property_ref,
      property_url: lead.page_url,
      message_text: lead.message_text,
      source: WEBSITE_SOURCE,
      status: "new",
      listing_id: match.listingId,
      assigned_to: null,
      is_hot: isHot,
      // Everything worth keeping is already in the columns above; a raw copy
      // would only be a second store of the visitor's personal data.
      raw_body: null,
      api_key_id: input.apiKeyId,
    })
    .select("id")
    .single();

  if (!error) return { kind: "created", id: data.id as string, warnings, redirect };

  if (error.code === "23505") {
    const { data: existing, error: lookupError } = await admin
      .from("leads")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("message_id", messageId)
      .maybeSingle();
    if (existing) return { kind: "duplicate", id: existing.id as string, redirect };
    throw new IngestError("duplicate lookup", lookupError?.code);
  }

  throw new IngestError("insert", error.code);
}
