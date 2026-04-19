"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireShareAccess, ShareAccessError } from "@/lib/auth/requireShareAccess";
import { CreateShareSchema, UpdateShareSchema } from "../domain/schemas";
import { generateShareToken } from "../lib/token";

export type ActionResult =
  | { ok: true; shareId?: string }
  | { ok: false; error: string };

function parseStatuses(formData: FormData): string[] {
  return formData.getAll("availability_statuses").map(String).filter(Boolean);
}

function parseExpiresAt(value: FormDataEntryValue | null): string | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseScope(formData: FormData): {
  portfolio_id: string | null;
  property_ids: string[] | null;
} {
  const scopeKind = String(formData.get("scope_kind") ?? "all");
  if (scopeKind === "portfolio") {
    const id = String(formData.get("portfolio_id") ?? "").trim();
    return { portfolio_id: id || null, property_ids: null };
  }
  if (scopeKind === "properties") {
    const ids = formData
      .getAll("property_ids")
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
    return { portfolio_id: null, property_ids: ids.length > 0 ? ids : null };
  }
  return { portfolio_id: null, property_ids: null };
}

export async function createShareAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const scope = parseScope(formData);
  const input = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    availability_statuses: parseStatuses(formData),
    commission_override_pct: Number(formData.get("commission_override_pct")),
    expires_at: parseExpiresAt(formData.get("expires_at")),
    portfolio_id: scope.portfolio_id,
    property_ids: scope.property_ids,
  };

  const parsed = CreateShareSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid input" };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("property_shares")
    .insert({
      tenant_id: profile.tenant_id,
      token: generateShareToken(),
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      availability_statuses: parsed.data.availability_statuses,
      commission_override_pct: parsed.data.commission_override_pct,
      expires_at: parsed.data.expires_at ?? null,
      portfolio_id: parsed.data.portfolio_id ?? null,
      property_ids: parsed.data.property_ids ?? null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/shares");
  redirect(`/shares/${data.id}`);
}

export async function updateShareAction(shareId: string, formData: FormData): Promise<ActionResult> {
  const scope = parseScope(formData);
  const input = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    availability_statuses: parseStatuses(formData),
    commission_override_pct: Number(formData.get("commission_override_pct")),
    expires_at: parseExpiresAt(formData.get("expires_at")),
    portfolio_id: scope.portfolio_id,
    property_ids: scope.property_ids,
  };

  const parsed = UpdateShareSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid input" };
  }

  let share;
  try {
    ({ share } = await requireShareAccess(shareId));
  } catch (err) {
    if (err instanceof ShareAccessError) return { ok: false, error: err.code };
    throw err;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("property_shares")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      availability_statuses: parsed.data.availability_statuses,
      commission_override_pct: parsed.data.commission_override_pct,
      expires_at: parsed.data.expires_at ?? null,
      portfolio_id: parsed.data.portfolio_id ?? null,
      property_ids: parsed.data.property_ids ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", share.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/shares");
  revalidatePath(`/shares/${share.id}`);
  return { ok: true, shareId: share.id };
}

export async function revokeShareAction(shareId: string): Promise<ActionResult> {
  let share;
  try {
    ({ share } = await requireShareAccess(shareId));
  } catch (err) {
    if (err instanceof ShareAccessError) return { ok: false, error: err.code };
    throw err;
  }

  if (share.revoked_at) return { ok: false, error: "already_revoked" };

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("property_shares")
    .update({ revoked_at: now, updated_at: now })
    .eq("id", share.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/shares");
  revalidatePath(`/shares/${share.id}`);
  return { ok: true, shareId: share.id };
}
