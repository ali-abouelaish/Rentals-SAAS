import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGmailClientForTenant, fetchMessagesByHistoryId, fetchMessage } from "@/lib/gmail/apiClient";
import { processEmail } from "@/lib/gmail/processEmail";

function secretsMatch(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  // Validate the shared secret. Prefer a header so the secret doesn't leak into
  // nginx access logs / proxy referrers. Google Pub/Sub push can't set custom
  // headers, so the `?secret=` query param is kept as a fallback — the robust
  // fix for the Pub/Sub path is to enable OIDC push auth and verify the Bearer
  // token against Google's public keys (audience + service-account email).
  const headerSecret =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  const querySecret = request.nextUrl.searchParams.get("secret");
  const provided = headerSecret ?? querySecret;
  if (!secretsMatch(provided, process.env.GMAIL_WEBHOOK_SECRET)) {
    // Return 200 anyway to prevent Pub/Sub retry storms on misconfiguration
    return NextResponse.json({ ok: false, reason: "invalid_secret" });
  }

  let body: { message?: { data?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const encodedData = body?.message?.data;
  if (!encodedData) {
    return NextResponse.json({ ok: true });
  }

  let notification: { emailAddress?: string; historyId?: string };
  try {
    notification = JSON.parse(Buffer.from(encodedData, "base64").toString("utf8"));
  } catch {
    return NextResponse.json({ ok: true });
  }

  const { emailAddress, historyId } = notification;
  if (!emailAddress || !historyId) {
    return NextResponse.json({ ok: true });
  }

  const admin = createSupabaseAdminClient();

  // Find tenant by gmail address
  const { data: conn } = await admin
    .from("tenant_gmail_connections")
    .select("tenant_id, history_id")
    .eq("gmail_address", emailAddress)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ ok: true });
  }

  const tenantId = conn.tenant_id;
  const lastHistoryId = conn.history_id ?? historyId;

  try {
    const gmailClient = await getGmailClientForTenant(tenantId);
    const messageIds = await fetchMessagesByHistoryId(gmailClient, lastHistoryId);

    for (const msgId of messageIds) {
      const message = await fetchMessage(gmailClient, msgId);
      if (!message) continue;
      await processEmail(message, tenantId);
    }

    // Update history_id and last_synced_at
    await admin
      .from("tenant_gmail_connections")
      .update({
        history_id: historyId,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Still return 200 to prevent Pub/Sub from retrying
  }

  return NextResponse.json({ ok: true });
}
