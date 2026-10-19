// Contract documents live in private storage and are reached through app
// routes, never through a stored storage URL.
//
// The columns that used to hold a link (property_contracts.document_url,
// properties.contract_document_url) now hold a stable route such as
// /api/contracts/{id}/document. The route checks the caller can see the row
// under RLS, then redirects to a signed URL that lives for a few minutes. A
// stored signed URL died an hour after it was written; a stored public URL
// never died at all, and served tenants' personal details to anyone holding it.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

export const CONTRACTS_BUCKET = "property_contracts";

/** Long enough for a browser PDF viewer's follow-up range requests. */
const LINK_TTL_SECONDS = 5 * 60;

export function contractDocumentRoute(contractId: string): string {
  return `/api/contracts/${contractId}/document`;
}

export function propertyContractDocumentRoute(propertyId: string): string {
  return `/api/properties/${propertyId}/contract-document`;
}

/** True for a value that is one of our document routes rather than a real link. */
export function isDocumentRoute(value: string | null | undefined): boolean {
  return !!value && /^\/api\/(contracts|properties)\/[^/]+\/(document|contract-document)/.test(value);
}

/**
 * The storage path inside `bucket` that a legacy public or signed storage URL
 * points at, or null when the value is not one of ours.
 */
export function storagePathFromUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const escaped = bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${escaped}/([^?#]+)`).exec(url);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** An external link (e.g. a Google Drive URL an agent pasted in). */
export function externalLink(value: string | null | undefined): string | null {
  if (!value || isDocumentRoute(value)) return null;
  return /^https?:\/\//i.test(value) && !/\/storage\/v1\/object\//.test(value) ? value : null;
}

/**
 * PostgREST's answer when a column in the payload doesn't exist yet. Migrations
 * are applied by hand, so new columns are written best-effort until then.
 */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || error.code === "42703" || /column .* does not exist|Could not find the '.*' column/i.test(error.message ?? "");
}

export async function signedDocumentUrl(bucket: string, path: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, LINK_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * The verified caller, for the document routes. getUser() checks the token
 * with Supabase Auth — the cookie is not trusted on its own — and the profile
 * read runs under RLS. Contract documents are admin-only, like the screens
 * that link to them.
 */
export async function requireDocumentViewer(): Promise<
  | { ok: true; supabase: ReturnType<typeof createSupabaseServerClient> }
  | { ok: false; status: 401 | 403 }
> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();
  if (!profile || !isAdminRole(profile.role)) return { ok: false, status: 403 };

  return { ok: true, supabase };
}
