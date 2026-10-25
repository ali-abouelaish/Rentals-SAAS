"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { deriveSiteSecret, isSiteSignInConfigured } from "@/lib/site-sign-in/token";
import { quickLinkSchema, type QuickLinkValues } from "../domain/schemas";

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const SIGN_IN_UNAVAILABLE = "Website sign-in isn't available yet. Please contact Harbor support.";

type QuickLinkRow = {
  title: string;
  url: string;
  description: string | null;
  sso_enabled: boolean;
  sso_callback_url: string | null;
};

function parseLink(values: QuickLinkValues): ActionResult<{ row: QuickLinkRow }> {
  const parsed = quickLinkSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the link details." };
  }
  const v = parsed.data;
  return {
    ok: true,
    row: {
      title: v.title,
      url: v.url,
      description: v.description || null,
      sso_enabled: v.sso_enabled,
      // Kept when sign-in is switched off, so switching it back on needs no retyping.
      sso_callback_url: v.sso_callback_url || null,
    },
  };
}

export async function addQuickLink(values: QuickLinkValues): Promise<ActionResult<{ id: string }>> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const parsed = parseLink(values);
  if (!parsed.ok) return parsed;
  if (parsed.row.sso_enabled && !isSiteSignInConfigured()) return { ok: false, error: SIGN_IN_UNAVAILABLE };

  const supabase = createSupabaseServerClient();

  // Place new link after the current last one
  const { data: existing } = await supabase
    .from("tenant_quick_links")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (existing?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("tenant_quick_links")
    .insert({ tenant_id: profile.tenant_id, position, ...parsed.row })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[quick-links] add failed", error?.code);
    return { ok: false, error: "Couldn't add the link. Please try again." };
  }

  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateQuickLink(id: string, values: QuickLinkValues): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const linkId = z.string().uuid().safeParse(id);
  if (!linkId.success) return { ok: false, error: "Unknown link." };

  const parsed = parseLink(values);
  if (!parsed.ok) return parsed;
  if (parsed.row.sso_enabled && !isSiteSignInConfigured()) return { ok: false, error: SIGN_IN_UNAVAILABLE };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_quick_links")
    .update({ ...parsed.row, updated_at: new Date().toISOString() })
    .eq("id", linkId.data)
    .eq("tenant_id", profile.tenant_id)
    .select("id");

  if (error) {
    console.error("[quick-links] update failed", error.code);
    return { ok: false, error: "Couldn't save the link. Please try again." };
  }
  if (!data?.length) return { ok: false, error: "That link no longer exists." };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function reorderQuickLinks(
  items: Array<{ id: string; position: number }>
) {
  const profile = await requireRole(["admin", "super_admin"]);
  const supabase = createSupabaseServerClient();

  await Promise.all(
    items.map(({ id, position }) =>
      supabase
        .from("tenant_quick_links")
        .update({ position, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", profile.tenant_id)
    )
  );

  revalidatePath("/dashboard");
}

export async function deleteQuickLink(formData: FormData) {
  await requireRole(["admin", "super_admin"]);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = createSupabaseServerClient();
  await supabase.from("tenant_quick_links").delete().eq("id", id);

  revalidatePath("/dashboard");
}

/**
 * The secret the agency's website verifies sign-in tokens with. Derived on
 * demand, never stored, so admins can fetch it again whenever their web
 * developer needs it.
 */
export async function getQuickLinkSiteSecret(id: string): Promise<ActionResult<{ secret: string }>> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const linkId = z.string().uuid().safeParse(id);
  if (!linkId.success) return { ok: false, error: "Unknown link." };
  if (!isSiteSignInConfigured()) return { ok: false, error: SIGN_IN_UNAVAILABLE };

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("tenant_quick_links")
    .select("id, sso_key_id")
    .eq("id", linkId.data)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!data) return { ok: false, error: "That link no longer exists." };

  return { ok: true, secret: deriveSiteSecret(data.id, data.sso_key_id) };
}

/**
 * Replace a site's secret (it was exposed, or a developer left). The old
 * secret stops working at once, so the website refuses sign-ins until the
 * new one is pasted in.
 */
export async function replaceQuickLinkSiteSecret(id: string): Promise<ActionResult<{ secret: string }>> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const linkId = z.string().uuid().safeParse(id);
  if (!linkId.success) return { ok: false, error: "Unknown link." };
  if (!isSiteSignInConfigured()) return { ok: false, error: SIGN_IN_UNAVAILABLE };

  const keyId = randomUUID();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_quick_links")
    .update({ sso_key_id: keyId, updated_at: new Date().toISOString() })
    .eq("id", linkId.data)
    .eq("tenant_id", profile.tenant_id)
    .select("id");

  if (error) {
    console.error("[quick-links] secret replace failed", error.code);
    return { ok: false, error: "Couldn't replace the secret. Please try again." };
  }
  if (!data?.length) return { ok: false, error: "That link no longer exists." };

  return { ok: true, secret: deriveSiteSecret(linkId.data, keyId) };
}
