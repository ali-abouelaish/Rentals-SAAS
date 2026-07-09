import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateCodeVerifier, challengeFromVerifier, randomState } from "@/lib/mydeposits/pkce";
import { buildAuthorizeUrl } from "@/lib/mydeposits/oauth";
import { mdOAuthConfig, resolveMdAuthMode, resolveMdEnvironment } from "@/lib/mydeposits/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PKCE_COOKIE = "md_pkce";
const TEN_MIN_MS = 10 * 60 * 1000;

export async function GET() {
  const profile = await requireRole([...ADMIN_ROLES]);

  // The headless (email/SMS) auth mode has no interactive connect UI — it is
  // driven manually via scripts/mydeposits-headless-login.mjs (see
  // src/lib/mydeposits/headlessAuth.ts). Honour the flag explicitly rather than
  // silently launching the browser redirect the operator opted out of.
  if (resolveMdAuthMode() === "headless") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(`${appUrl}/settings/deposits?error=headless_not_supported`);
  }

  const env = resolveMdEnvironment();
  const { redirectUri } = mdOAuthConfig();

  const codeVerifier = generateCodeVerifier();
  const state = randomState();
  const codeChallenge = challengeFromVerifier(codeVerifier);

  // DB fallback for the PKCE verifier (cookie is the primary recovery path).
  const admin = createSupabaseAdminClient();
  await admin.from("mydeposits_oauth_states").insert({
    state,
    tenant_id: profile.tenant_id,
    code_verifier: codeVerifier,
    expires_at: new Date(Date.now() + TEN_MIN_MS).toISOString(),
  });

  cookies().set(PKCE_COOKIE, `${state}.${codeVerifier}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TEN_MIN_MS / 1000,
  });

  return NextResponse.redirect(buildAuthorizeUrl(env, { state, codeChallenge, redirectUri }));
}
