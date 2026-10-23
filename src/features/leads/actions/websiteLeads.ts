"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { LEADS_WRITE_SCOPE } from "@/lib/api-keys/scopes";
import { mintPublicApiKey, revalidateApiKeyPages } from "@/features/api-keys/data/mint";
import { websiteConnectionSchema, type WebsiteConnectionValues } from "../domain/schemas";

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Connect a website: mint a key that can only add leads. The plaintext is
 * returned this once and never stored, so the dialog must show it now.
 */
export async function createWebsiteConnection(
  values: WebsiteConnectionValues
): Promise<ActionResult<{ plaintext: string }>> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const [leadsOn, websiteLeadsOn] = await Promise.all([hasFeature("leads"), hasFeature("website_leads")]);
  if (!leadsOn || !websiteLeadsOn) {
    return { ok: false, error: "Website lead capture isn't enabled for your agency." };
  }

  const parsed = websiteConnectionSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the website name." };
  }

  try {
    const { plaintext } = await mintPublicApiKey({
      tenantId: profile.tenant_id,
      createdBy: profile.id,
      label: parsed.data.label,
      scopes: [LEADS_WRITE_SCOPE],
    });
    revalidateApiKeyPages();
    return { ok: true, plaintext };
  } catch (err) {
    console.error("[website-leads] connect failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Couldn't connect the website. Please try again." };
  }
}

/**
 * Disconnect a website: revoke its key so the site's enquiries stop arriving
 * at once. Leads it already delivered are kept. Deliberately not gated on the
 * entitlement — cutting off a key must always be possible.
 */
export async function revokeWebsiteConnection(id: string): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const keyId = z.string().uuid().safeParse(id);
  if (!keyId.success) return { ok: false, error: "Unknown website." };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("public_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId.data)
    .eq("tenant_id", profile.tenant_id)
    .contains("scopes", [LEADS_WRITE_SCOPE])
    .is("revoked_at", null)
    .select("id");

  if (error) {
    console.error("[website-leads] disconnect failed", error.code);
    return { ok: false, error: "Couldn't disconnect the website. Please try again." };
  }
  if (!data?.length) return { ok: false, error: "That website is already disconnected." };

  revalidateApiKeyPages();
  return { ok: true };
}
