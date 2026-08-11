import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAgency } from "@/lib/email/agency-context";
import { encryptProviderCredentials } from "@/lib/email-providers/encrypt";
import { exchangeCodeForTokens, fetchMailboxAddress } from "@/lib/email-providers/graph/oauth";
import { consumeOAuthState } from "@/lib/email-providers/oauth-state";
import { buildEmailSettingsUrl, fallbackEmailSettingsUrl } from "@/lib/email-providers/oauth-redirect";
import type { OAuthCredentials } from "@/lib/email/transport/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (searchParams.get("error")) {
    return NextResponse.redirect(
      fallbackEmailSettingsUrl({
        error: "graph_auth_failed",
        reason: (searchParams.get("error_description") ?? searchParams.get("error") ?? "").slice(0, 300),
      }),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(fallbackEmailSettingsUrl({ error: "missing_code" }));
  }

  const consumed = await consumeOAuthState(state, "graph");
  if (!consumed) {
    return NextResponse.redirect(fallbackEmailSettingsUrl({ error: "invalid_state" }));
  }
  const { tenantId, codeVerifier } = consumed;

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const mailbox = await fetchMailboxAddress(tokens.accessToken);
    const agency = await loadAgency(tenantId);

    const credentials: OAuthCredentials = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiry: tokens.expiry,
    };

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("email_providers").upsert(
      {
        tenant_id: tenantId,
        type: "graph",
        credentials: encryptProviderCredentials(JSON.stringify(credentials)),
        from_address: mailbox,
        from_name: agency?.name || agency?.branding.from_display_name || null,
        status: "active",
        verified_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "tenant_id" },
    );
    if (error) throw new Error(error.message);

    return NextResponse.redirect(await buildEmailSettingsUrl(tenantId, { connected: "1" }));
  } catch (err) {
    console.error("Graph OAuth callback error:", err);
    return NextResponse.redirect(
      await buildEmailSettingsUrl(tenantId, {
        error: "graph_auth_failed",
        reason: (err instanceof Error ? err.message : "unknown").slice(0, 300),
      }),
    );
  }
}
