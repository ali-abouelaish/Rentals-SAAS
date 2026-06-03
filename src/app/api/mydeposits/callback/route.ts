import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exchangeCode } from "@/lib/mydeposits/oauth";
import { encryptToken } from "@/lib/mydeposits/encrypt";
import { mdOAuthConfig, resolveMdEnvironment } from "@/lib/mydeposits/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PKCE_COOKIE = "md_pkce";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function settingsRedirect(query: string) {
  return NextResponse.redirect(`${APP_URL}/settings/deposits?${query}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) return settingsRedirect(`error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return settingsRedirect("error=missing_code");

  // requireRole gives us the authenticated admin's tenant — the OAuth callback
  // runs in the user's session (middleware exempts /api/ from the auth redirect).
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  try {
    // Recover the PKCE verifier: cookie first, DB fallback.
    let codeVerifier: string | null = null;
    const cookieVal = cookies().get(PKCE_COOKIE)?.value;
    if (cookieVal) {
      const [cookieState, verifier] = cookieVal.split(".");
      if (cookieState === state && verifier) codeVerifier = verifier;
    }

    if (!codeVerifier) {
      const { data: row } = await admin
        .from("mydeposits_oauth_states")
        .select("code_verifier, expires_at, consumed_at")
        .eq("state", state)
        .eq("tenant_id", profile.tenant_id)
        .single();
      if (
        row &&
        !row.consumed_at &&
        new Date(row.expires_at).getTime() > Date.now()
      ) {
        codeVerifier = row.code_verifier;
      }
    }

    if (!codeVerifier) return settingsRedirect("error=invalid_state");

    // Mark the state consumed (single use).
    await admin
      .from("mydeposits_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("state", state);

    const env = resolveMdEnvironment();
    const { redirectUri } = mdOAuthConfig();
    const tokens = await exchangeCode(env, { code, codeVerifier, redirectUri });

    const { error: upsertError } = await admin.from("mydeposits_connections").upsert(
      {
        tenant_id: profile.tenant_id,
        environment: env,
        access_token: encryptToken(tokens.accessToken),
        refresh_token: encryptToken(tokens.refreshToken),
        token_expiry: tokens.expiry.toISOString(),
        connected_by: profile.id,
      },
      { onConflict: "tenant_id" }
    );
    if (upsertError) throw new Error(upsertError.message);

    cookies().delete(PKCE_COOKIE);
    return settingsRedirect("connected=1");
  } catch (err) {
    console.error("mydeposits OAuth callback error:", err);
    cookies().delete(PKCE_COOKIE);
    return settingsRedirect("error=connect_failed");
  }
}
