"use server";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPortalDomain } from "@/lib/tenant-host";
import { rateLimitCheck } from "@/features/property-shares/lib/rate-limit";
import {
  generateDemoRequestConfirmationEmail,
  generateDemoRequestTeamEmail,
} from "@/lib/email/templates/demo-request";
import { demoRequestSchema, HONEYPOT_FIELD, portfolioLabel, type DemoRequestValues } from "../domain/schemas";
import { sendPlatformEmail } from "../lib/platformEmail";
import { requestIp } from "../lib/requestIp";

export type DemoRequestResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Partial<Record<keyof DemoRequestValues, string>> };

const PER_IP_WINDOW_MS = 10 * 60_000;
const PER_IP_MAX = 3;
// The requester's confirmation goes to whatever address was typed in, so it is capped: one per
// address per day, and a ceiling across everyone per hour.
const CONFIRMATIONS_PER_HOUR = 30;
const DAY_MS = 24 * 60 * 60_000;
const FALLBACK_REPLY_TO = "info@harborops.co.uk"; // the address the website shows

/**
 * A demo (or Enterprise quote) request from the website's front door. Saved for the super-admin
 * Demo Requests page, emailed to the team, and confirmed to the requester. Succeeds when either
 * the save or the team email worked, so a request is never silently lost.
 */
export async function submitDemoRequest(input: unknown): Promise<DemoRequestResult> {
  // A field people never see. Anything in it means a bot filled the form in: act as if it
  // worked, keep nothing.
  const honeypot = (input as Record<string, unknown> | null)?.[HONEYPOT_FIELD];
  if (typeof honeypot === "string" && honeypot.trim()) {
    // Logged so a real person caught by it (autofill, a password manager) shows up somewhere.
    console.warn("[demo-requests] honeypot filled; request dropped", { length: honeypot.length });
    return { ok: true };
  }

  const parsed = demoRequestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const fields: Partial<Record<keyof DemoRequestValues, string>> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (messages?.[0]) fields[field as keyof DemoRequestValues] = messages[0];
    }
    return { ok: false, error: "Some answers need attention.", fields };
  }
  const v = parsed.data;
  const email = v.email.toLowerCase();

  const limit = rateLimitCheck(`demo-request:${requestIp(headers())}`, PER_IP_WINDOW_MS, PER_IP_MAX);
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return {
      ok: false,
      error: `That’s a few requests in a row. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or email ${FALLBACK_REPLY_TO}.`,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: saved, error: saveError } = await admin
    .from("demo_requests")
    .insert({
      first_name: v.first_name,
      last_name: v.last_name,
      email,
      company: v.company,
      portfolio_size: v.portfolio_size,
      goal: v.goal || null,
      plan_interest: v.plan,
      terms_accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (saveError) console.error("[demo-requests] could not save a request", saveError);

  const quote = v.plan === "enterprise";
  const portal = getPortalDomain();
  const adminUrl = saved
    ? portal
      ? `https://${portal}/admin/demo-requests/${saved.id}`
      : `/admin/demo-requests/${saved.id}`
    : null;

  const salesInbox = process.env.PLATFORM_SALES_EMAIL?.trim() || null;
  let teamNotified = false;
  if (salesInbox) {
    teamNotified = await sendPlatformEmail({
      to: salesInbox,
      replyTo: email,
      templateKey: "demo_request_team",
      ...generateDemoRequestTeamEmail({
        name: `${v.first_name} ${v.last_name}`,
        email,
        company: v.company,
        portfolioLabel: portfolioLabel(v.portfolio_size),
        goal: v.goal || null,
        quote,
        adminUrl,
      }),
    });
  } else {
    console.warn("[demo-requests] PLATFORM_SALES_EMAIL is not set; skipping the team email");
  }

  if (!saved && !teamNotified) {
    return {
      ok: false,
      error: `We couldn’t send your request just now. Please email ${FALLBACK_REPLY_TO} and we’ll pick it up from there.`,
    };
  }

  const confirmed =
    (await mayConfirm(admin, email)) &&
    (await sendPlatformEmail({
      to: email,
      replyTo: salesInbox ?? FALLBACK_REPLY_TO,
      templateKey: "demo_request_confirmation",
      ...generateDemoRequestConfirmationEmail({ firstName: v.first_name, quote }),
    }));

  if (saved && (teamNotified || confirmed)) {
    const now = new Date().toISOString();
    const { error } = await admin
      .from("demo_requests")
      .update({
        team_notified_at: teamNotified ? now : null,
        confirmation_sent_at: confirmed ? now : null,
      })
      .eq("id", saved.id);
    if (error) console.error("[demo-requests] could not record the emails sent", error);
  }

  return { ok: true };
}

/** One confirmation per address per day, and at most CONFIRMATIONS_PER_HOUR overall. */
async function mayConfirm(admin: SupabaseClient, email: string): Promise<boolean> {
  const [sameAddress, lastHour] = await Promise.all([
    admin
      .from("demo_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("confirmation_sent_at", new Date(Date.now() - DAY_MS).toISOString()),
    admin
      .from("demo_requests")
      .select("id", { count: "exact", head: true })
      .gte("confirmation_sent_at", new Date(Date.now() - 60 * 60_000).toISOString()),
  ]);
  if (sameAddress.error || lastHour.error) {
    // The table isn't there (migration not applied yet): fall back to this process's memory.
    return rateLimitCheck(`demo-confirm:${email}`, DAY_MS, 1).allowed;
  }
  return (sameAddress.count ?? 0) === 0 && (lastHour.count ?? 0) < CONFIRMATIONS_PER_HOUR;
}
