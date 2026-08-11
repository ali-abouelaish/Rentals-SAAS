import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { generateCodeVerifier, challengeFromVerifier } from "@/lib/mydeposits/pkce";
import { buildAuthorizeUrl } from "@/lib/email-providers/graph/oauth";
import { createOAuthState } from "@/lib/email-providers/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await requireRole([...ADMIN_ROLES]);

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = challengeFromVerifier(codeVerifier);
  // State + verifier live in the DB (not a cookie) so the flow survives the hop
  // from this tenant subdomain to the fixed OAuth callback host.
  const state = await createOAuthState({ tenantId: profile.tenant_id, provider: "graph", codeVerifier });

  return NextResponse.redirect(buildAuthorizeUrl({ state, codeChallenge }));
}
