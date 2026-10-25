import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SITE_SIGN_IN_TOKEN_FIELD, signSiteSignInToken } from "@/lib/site-sign-in/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens a Useful Resources link with website sign-in: mints a short-lived
 * token for the signed-in staff member and form-posts it to the site's
 * sign-in URL. POST rather than ?token= so the token never lands in browser
 * history, the site's access logs or a Referer header.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = z.string().uuid().safeParse(params.id);
  if (!id.success) return new NextResponse("Link not found", { status: 404 });

  // Redirects to /login when signed out and locks out disabled agents.
  const profile = await requireUserProfile();

  // getUser() asks Supabase Auth, so this email is verified — the cookie JWT
  // is decoded unverified app-side, and the website picks the account by it.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || user.id !== profile.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { data: link } = await supabase
    .from("tenant_quick_links")
    .select("id, title, url, sso_enabled, sso_callback_url, sso_key_id")
    .eq("id", id.data)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!link) return new NextResponse("Link not found", { status: 404 });

  // Sign-in was switched off after the dashboard loaded: just open the site.
  if (!link.sso_enabled || !link.sso_callback_url) {
    return NextResponse.redirect(link.url);
  }

  let token: string;
  try {
    token = signSiteSignInToken({
      linkId: link.id,
      keyId: link.sso_key_id,
      callbackUrl: link.sso_callback_url,
      returnTo: link.url,
      user: {
        id: profile.id,
        email: user.email,
        name: profile.display_name ?? null,
        role: profile.role,
        isAdmin: isAdminRole(profile.role),
        tenantId: profile.tenant_id,
      },
    });
  } catch (err) {
    // Typically QUICK_LINK_SSO_SECRET missing on this server.
    console.error("[site-sign-in] token mint failed", err instanceof Error ? err.message : err);
    return new NextResponse("Website sign-in isn't available right now. Please contact Harbor support.", {
      status: 503,
    });
  }

  const nonce = randomBytes(16).toString("base64");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Signing you in…</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#444}</style>
</head>
<body>
<form id="f" method="post" action="${escapeHtml(link.sso_callback_url)}">
<input type="hidden" name="${SITE_SIGN_IN_TOKEN_FIELD}" value="${escapeHtml(token)}">
<p>Signing you in to ${escapeHtml(link.title)}…</p>
<noscript><button type="submit">Continue</button></noscript>
</form>
<script nonce="${nonce}">document.getElementById("f").submit();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      // No form-action: a site that redirects after sign-in (apex -> www)
      // would be blocked by it, and nothing here is attacker-controlled.
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
