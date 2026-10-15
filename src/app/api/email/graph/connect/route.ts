import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { generateCodeVerifier, challengeFromVerifier } from "@/lib/mydeposits/pkce";
import { buildAuthorizeUrl } from "@/lib/email-providers/graph/oauth";
import { createOAuthState } from "@/lib/email-providers/oauth-state";
import { buildEmailSettingsUrl } from "@/lib/email-providers/oauth-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await requireRole([...ADMIN_ROLES]);

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = challengeFromVerifier(codeVerifier);

  let authorizeUrl: string;
  try {
    // State + verifier live in the DB (not a cookie) so the flow survives the hop
    // from this tenant subdomain to the fixed OAuth callback host.
    const state = await createOAuthState({ tenantId: profile.tenant_id, provider: "graph", codeVerifier });
    authorizeUrl = buildAuthorizeUrl({ state, codeChallenge });
  } catch (err) {
    // Typically missing OAuth env vars on this server. Send the admin back to
    // Email Sending with a message rather than a bare 500 page; the detail is
    // in the server log.
    console.error("Microsoft connect failed:", err);
    return NextResponse.redirect(
      await buildEmailSettingsUrl(profile.tenant_id, { error: "graph_unavailable" }),
    );
  }

  return NextResponse.redirect(authorizeUrl);
}
