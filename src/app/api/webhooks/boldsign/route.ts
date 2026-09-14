// Inbound BoldSign webhook.
//
// Ordering is the whole point of this file:
//
//   1. request.text() — the raw body, byte for byte.
//   2. Verify the HMAC against those exact bytes.
//   3. Only then parse the JSON.
//
// Anything that parses before verifying (or verifies a re-serialised object)
// produces a check that passes in testing and fails against real payloads, or
// worse, silently accepts forgeries. Next.js App Router hands route handlers an
// untouched Request — no global body parser, no CSRF middleware — so step 1 is
// simply request.text(). See src/app/api/webhooks/resend/route.ts for the same
// shape.
//
// Every event is persisted before it is acted on, so a handler failure can be
// replayed rather than lost, and so redelivery is cheap to detect. The status
// transition itself lives in src/lib/boldsign/events.ts.
//
// Response codes are chosen for BoldSign's retry behaviour, which fires on any
// non-2xx: 401 for a bad signature (retrying won't help, but nor should we
// pretend to have accepted it), 500 where a retry is genuinely wanted, and 200
// for anything verified that we have deliberately decided not to act on.

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { boldSignWebhookSecret } from "@/lib/boldsign/config";
import { processBoldSignEvent } from "@/lib/boldsign/events";
import {
  BOLDSIGN_SIGNATURE_HEADER,
  verifyBoldSignSignature,
} from "@/lib/boldsign/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Postgres unique_violation — the idempotency guard firing. */
const PG_UNIQUE_VIOLATION = "23505";

type BoldSignWebhookPayload = {
  event?: {
    id?: string;
    eventType?: string;
    environment?: string;
    created?: string;
  };
  data?: {
    object?: string;
    documentId?: string;
    metaData?: Record<string, string | null> | null;
    [key: string]: unknown;
  } | null;
};

export async function POST(request: Request) {
  // ── 1. Raw body, before anything touches it ──────────────────────
  const rawBody = await request.text();
  const signature = request.headers.get(BOLDSIGN_SIGNATURE_HEADER);

  let secret: string;
  try {
    secret = boldSignWebhookSecret();
  } catch {
    // Misconfiguration, not a bad request. 500 makes BoldSign retry, which is
    // what we want once the secret is set.
    console.error("[boldsign] webhook received but BOLDSIGN_WEBHOOK_SECRET is not set");
    return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 500 });
  }

  // ── 2. Verify against those exact bytes ──────────────────────────
  const verification = verifyBoldSignSignature(rawBody, signature, secret);
  if (!verification.ok) {
    // Deliberately non-200 and deliberately vague to the caller: the reason is
    // useful in our logs, not to whoever sent an unsigned payload.
    console.warn("[boldsign] webhook signature rejected", { reason: verification.reason });
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  // ── 3. Now it is safe to parse ───────────────────────────────────
  let payload: BoldSignWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as BoldSignWebhookPayload;
  } catch {
    // Signed but unparseable. Retrying won't help, so ack it rather than
    // inviting a retry loop.
    console.error("[boldsign] webhook body passed verification but is not JSON");
    return NextResponse.json({ ok: true, ignored: "unparseable" });
  }

  const eventType = payload.event?.eventType ?? "Unknown";
  const eventId = payload.event?.id ?? null;

  // BoldSign posts this when the URL is first registered, and expects a 200
  // inside 10 seconds. It carries no document, so there is nothing to store.
  if (eventType === "Verification") {
    console.log("[boldsign] webhook URL verification received");
    return NextResponse.json({ ok: true });
  }

  if (!eventId) {
    // Without an id there is no idempotency key, so processing it risks acting
    // twice on a redelivery. Record nothing and ack.
    console.error("[boldsign] webhook event has no event id", { eventType });
    return NextResponse.json({ ok: true, ignored: "no_event_id" });
  }

  const documentId = payload.data?.documentId ?? null;
  // metaData is set at send time (src/lib/boldsign/send.ts) and echoed back on
  // every event, so the tenant is known even before the document lookup.
  const tenantId = payload.data?.metaData?.tenantId ?? null;

  // ── 4. Record. The unique index on event_id is the idempotency guard ──
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("boldsign_document_events").insert({
    tenant_id: tenantId,
    event_id: eventId,
    event_type: eventType,
    boldsign_document_id: documentId,
    payload: payload as unknown as Record<string, unknown>,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      // Redelivery. If the first delivery was fully processed there is nothing
      // to do; if processing failed back then, fall through and try again
      // rather than acking an event we never acted on.
      const { data: existing } = await admin
        .from("boldsign_document_events")
        .select("processed_at")
        .eq("event_id", eventId)
        .maybeSingle<{ processed_at: string | null }>();

      if (existing?.processed_at) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
    } else {
      // Couldn't store it — return non-200 so BoldSign retries rather than
      // dropping an event we have no record of.
      console.error("[boldsign] failed to record webhook event", {
        eventId,
        eventType,
        error: error.message,
      });
      return NextResponse.json({ ok: false, error: "Could not record event" }, { status: 500 });
    }
  }

  // ── 5. Act on it ─────────────────────────────────────────────────
  const processed = await processBoldSignEvent({ eventType, boldSignDocumentId: documentId });

  await admin
    .from("boldsign_document_events")
    .update(
      processed.ok
        ? { processed_at: new Date().toISOString(), process_error: null }
        : { process_error: processed.error }
    )
    .eq("event_id", eventId);

  if (!processed.ok) {
    // Non-200 so BoldSign redelivers. The event row is already stored, so the
    // retry path above will pick it up rather than treating it as a duplicate.
    console.error("[boldsign] event processing failed", {
      eventId,
      eventType,
      error: processed.error,
    });
    return NextResponse.json({ ok: false, error: "Could not process event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, outcome: processed.outcome });
}
