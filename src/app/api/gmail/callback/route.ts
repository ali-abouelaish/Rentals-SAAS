import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens } from "@/lib/gmail/oauthClient";
import { encryptToken } from "@/lib/gmail/encrypt";
import { getGmailClientForTenant, watchInbox } from "@/lib/gmail/apiClient";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tenantId = searchParams.get("state");

  if (!code || !tenantId) {
    return NextResponse.redirect(`${APP_URL}/leads/settings?error=gmail_auth_failed`);
  }

  try {
    const admin = createSupabaseAdminClient();

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get Gmail address from profile API
    const { google } = await import("googleapis");
    const { OAuth2 } = google.auth;
    const oauth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ access_token: tokens.accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profileRes = await gmail.users.getProfile({ userId: "me" });
    const gmailAddress = profileRes.data.emailAddress ?? "";
    // getProfile returns the mailbox's current historyId — a valid push cursor
    // even if the watch registration below fails.
    let historyId: string | null = profileRes.data.historyId ?? null;

    // Upsert connection
    const { error: upsertError } = await admin
      .from("tenant_gmail_connections")
      .upsert(
        {
          tenant_id: tenantId,
          gmail_address: gmailAddress,
          access_token: encryptToken(tokens.accessToken),
          refresh_token: encryptToken(tokens.refreshToken),
          token_expiry: tokens.expiry.toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );

    if (upsertError) throw new Error(upsertError.message);

    // Seed default platform configs if none exist
    const { data: existingConfigs } = await admin
      .from("tenant_platform_configs")
      .select("id")
      .eq("tenant_id", tenantId)
      .limit(1);

    if (!existingConfigs || existingConfigs.length === 0) {
      await admin.from("tenant_platform_configs").insert([
        { tenant_id: tenantId, platform_name: "zoopla", sender_domain: "zoopla.co.uk", is_active: true },
        { tenant_id: tenantId, platform_name: "rightmove", sender_domain: "rightmove.co.uk", is_active: true },
      ]);
    }

    // Register Gmail watch for push notifications. Best-effort, secondary step:
    // if the Pub/Sub topic isn't set up, the connection is still valid and the
    // user can pull mail via "Sync now", so a watch failure must NOT discard the
    // connection we just saved.
    const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
    if (topicName) {
      try {
        const gmailClient = await getGmailClientForTenant(tenantId);
        const watch = await watchInbox(gmailClient, topicName);
        historyId = watch.historyId || historyId;
      } catch (watchErr) {
        console.error("Gmail watch registration failed (connection still saved):", watchErr);
      }
    }

    if (historyId) {
      await admin
        .from("tenant_gmail_connections")
        .update({ history_id: historyId, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);
    }

    return NextResponse.redirect(`${APP_URL}/leads/settings?connected=1`);
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    const reason = err instanceof Error ? err.message : "unknown";
    const url = new URL(`${APP_URL}/leads/settings`);
    url.searchParams.set("error", "gmail_auth_failed");
    url.searchParams.set("reason", reason.slice(0, 300));
    return NextResponse.redirect(url.toString());
  }
}
