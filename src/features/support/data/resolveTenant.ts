import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ResolvedSupportTenant = {
  id: string;
  name: string;
  slug: string;
  alertEmail: string | null;
};

function getSlugFromRequest(request: NextRequest): string | null {
  const headerSlug = request.headers.get("x-tenant");
  if (headerSlug) return headerSlug;

  const host = request.headers.get("host");
  const hostname = host?.split(":")[0].toLowerCase() ?? "";
  if (hostname === "localhost" || hostname.startsWith("127.")) {
    return request.nextUrl.searchParams.get("companySlug");
  }
  return null;
}

function getSlugFromServerHeaders(): string | null {
  const h = headers();
  return h.get("x-tenant");
}

async function fetchBySlug(slug: string): Promise<ResolvedSupportTenant | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name, slug, alert_email")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    alertEmail: data.alert_email,
  };
}

export async function resolveSupportTenantFromRequest(
  request: NextRequest
): Promise<ResolvedSupportTenant | null> {
  const slug = getSlugFromRequest(request);
  if (!slug) return null;
  return fetchBySlug(slug);
}

export async function resolveSupportTenantFromServer(
  searchSlug?: string | null
): Promise<ResolvedSupportTenant | null> {
  const slug = searchSlug ?? getSlugFromServerHeaders();
  if (!slug) return null;
  return fetchBySlug(slug);
}
