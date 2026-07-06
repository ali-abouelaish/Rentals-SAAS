import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendEventBase = {
  type: string;
  created_at?: string;
  data: {
    email_id?: string;
    to?: string | string[];
    [key: string]: unknown;
  };
};

function firstRecipient(to: string | string[] | undefined): string | null {
  if (!to) return null;
  if (Array.isArray(to)) return to[0] ?? null;
  return to;
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 500 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, error: "Missing signature headers" }, { status: 400 });
  }

  const body = await request.text();
  const wh = new Webhook(secret);
  let event: ResendEventBase;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendEventBase;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[email] webhook signature failed", message);
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  // Respond 200 quickly; do DB work synchronously since it's just a couple of
  // small updates (no background continuation to rely on).
  try {
    await handle(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] webhook handler failed", { type: event.type, error: message });
    // Still 200 — Resend will retry only on non-2xx, and we don't want
    // to spam retries for a transient DB blip; we have logs to investigate.
  }

  return NextResponse.json({ ok: true });
}

async function handle(event: ResendEventBase) {
  const admin = createSupabaseAdminClient();
  const recipient = firstRecipient(event.data.to);

  switch (event.type) {
    case "email.bounced": {
      if (!recipient) return;
      const { error } = await admin
        .from("pm_tenants")
        .update({ email_status: "bounced" })
        .eq("email", recipient);
      if (error) console.error("[email] bounce update failed", error.message);
      return;
    }
    case "email.complained": {
      if (!recipient) return;
      const { error } = await admin
        .from("pm_tenants")
        .update({ email_status: "complained" })
        .eq("email", recipient);
      if (error) console.error("[email] complaint update failed", error.message);
      return;
    }
    case "email.delivered": {
      const providerId = event.data.email_id;
      if (!providerId) return;
      const { error } = await admin
        .from("rent_reminder_log")
        .update({ status: "sent" })
        .eq("email_provider_id", providerId);
      if (error) console.error("[email] delivery update failed", error.message);
      return;
    }
    default:
      return;
  }
}
