"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTelephone } from "@/lib/leads/enrich";
import { getPublicCardData } from "@/features/me/data/publicCard";
import { clientIpFromHeaders, rateLimitCheck } from "@/features/property-shares/lib/rate-limit";
import { BUSINESS_CARD_SOURCE, placeholderEmail } from "../domain/sources";
import { cardEnquirySchema, type CardEnquiryValues } from "../domain/schemas";

export type CardEnquiryResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Partial<Record<keyof CardEnquiryValues, string>> };

const INVALID_LINK = "This enquiry link isn't active. Please contact the agent directly.";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * A visitor's enquiry from an agent's digital business card, filed as a lead
 * assigned to that agent.
 *
 * The agency is resolved on the server from the agent. The form used to post
 * its own tenant_id, and this action trusted it, so anyone who knew an
 * agency's id could write leads into it. The browser now sends only the agent,
 * and the card must pass the same checks as the page that shows the form: it
 * exists, and the agency has business cards switched on.
 */
export async function submitCardEnquiry(agentId: string, values: CardEnquiryValues): Promise<CardEnquiryResult> {
  const agent = z.string().uuid().safeParse(agentId);
  if (!agent.success) return { ok: false, error: INVALID_LINK };

  const parsed = cardEnquirySchema.safeParse(values);
  if (!parsed.success) {
    const fields: Partial<Record<keyof CardEnquiryValues, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof CardEnquiryValues;
      fields[field] ??= issue.message;
    }
    return { ok: false, error: "Please check the highlighted fields.", fields };
  }

  const card = await getPublicCardData(agent.data);
  if (!card) return { ok: false, error: INVALID_LINK };

  // A card is public by design, so cap what one visitor — or a script — can file.
  const ip = clientIpFromHeaders({ headers: headers() });
  const limits = [
    rateLimitCheck(`card-enquiry:ip:${card.agentId}:${ip}`, MINUTE_MS, 3),
    rateLimitCheck(`card-enquiry:agent:${card.agentId}`, MINUTE_MS, 20),
    rateLimitCheck(`card-enquiry:day:${card.agentId}`, DAY_MS, 300),
  ];
  if (limits.some((l) => !l.allowed)) {
    return { ok: false, error: "Too many enquiries just now. Please wait a minute and try again." };
  }

  const { name, phone, pref_area, budget, occupation } = parsed.data;
  const parts: string[] = [];
  if (pref_area) parts.push(`Preferred area: ${pref_area}`);
  if (budget) parts.push(`Budget: ${budget}`);
  if (occupation) parts.push(`Occupation: ${occupation}`);

  // A random UUID: card enquiries have nothing to dedupe on, and the AI
  // assistant's first-party check expects this shape for business-card leads.
  const messageId = crypto.randomUUID();

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("leads").insert({
    tenant_id: card.tenantId,
    message_id: messageId,
    name,
    email: placeholderEmail("card", messageId),
    telephone: phone,
    telephone_clean: cleanTelephone(phone),
    has_phone: true,
    address: pref_area || null,
    message_text: parts.length ? parts.join("\n") : null,
    source: BUSINESS_CARD_SOURCE,
    status: "new",
    assigned_to: card.agentId,
  });

  if (error) {
    console.error("[card-enquiry] insert failed", error.code);
    return { ok: false, error: "Something went wrong sending your enquiry. Please try again." };
  }
  return { ok: true };
}
