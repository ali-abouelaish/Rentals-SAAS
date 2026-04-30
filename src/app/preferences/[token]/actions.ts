"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyPreferenceToken } from "@/lib/preferences/token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAgency } from "@/lib/email/agency-context";
import { loadPreferenceContext } from "@/features/preferences/data/queries";
import { notifyAgencyOfRequest } from "@/lib/email/notify-agency";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

function getRequestMeta(): RequestMeta {
  const h = headers();
  const fwd = h.get("x-forwarded-for") ?? "";
  // First entry in the X-Forwarded-For chain is the client; subsequent are
  // proxies. Take the first and trust the platform proxy in front of us.
  const ip = fwd.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent") ?? null;
  return { ipAddress: ip || null, userAgent: ua };
}

async function authorize(token: string) {
  const claims = verifyPreferenceToken(token);
  if (!claims) return null;
  return loadPreferenceContext(claims.pmTenantId);
}

async function persistAndNotify(opts: {
  ctx: NonNullable<Awaited<ReturnType<typeof authorize>>>;
  requestType: "email_change" | "alternative_format" | "data_access" | "other";
  payload: Record<string, unknown>;
}) {
  const { ipAddress, userAgent } = getRequestMeta();
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("tenant_communication_requests")
    .insert({
      tenant_id: opts.ctx.agencyId,
      pm_tenant_id: opts.ctx.pmTenantId,
      request_type: opts.requestType,
      payload: opts.payload,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const agency = await loadAgency(opts.ctx.agencyId);
  if (agency) {
    try {
      await notifyAgencyOfRequest({
        agency,
        pmTenantName: opts.ctx.pmTenantFullName,
        propertyAddress: opts.ctx.propertyAddress,
        requestId: data.id as string,
        requestType: opts.requestType,
        payload: opts.payload,
      });
    } catch (err) {
      // Don't fail the user-facing submission if the notify email blips.
      const message = err instanceof Error ? err.message : String(err);
      console.error("[email] notify-agency failed", { requestId: data.id, error: message });
    }
  }
}

/** Form-action signature: void return. Validation failures redirect with a
 *  query so the page can render an inline banner without JS. Programming
 *  errors throw and bubble to error.tsx. */
function fail(token: string, code: string): never {
  redirect(`/preferences/${token}?err=${code}`);
}
function ok(token: string, action: string): never {
  redirect(`/preferences/${token}?done=${action}`);
}

export async function submitEmailChange(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const ctx = await authorize(token);
  if (!ctx) fail(token, "invalid_link");

  const requested = String(formData.get("requested_email") ?? "").trim().toLowerCase();
  if (!requested || !EMAIL_RE.test(requested)) fail(token, "bad_email");

  await persistAndNotify({
    ctx,
    requestType: "email_change",
    payload: {
      current_email: ctx.pmTenantEmail,
      requested_email: requested,
    },
  });

  revalidatePath(`/preferences/${token}`);
  ok(token, "email_change");
}

export async function submitAlternativeFormat(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const ctx = await authorize(token);
  if (!ctx) fail(token, "invalid_link");

  const fmt = String(formData.get("format") ?? "").toLowerCase();
  if (!["postal", "sms", "other"].includes(fmt)) fail(token, "bad_format");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);

  await persistAndNotify({
    ctx,
    requestType: "alternative_format",
    payload: { format: fmt, notes },
  });

  revalidatePath(`/preferences/${token}`);
  ok(token, "alternative_format");
}

export async function submitDataAccess(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const ctx = await authorize(token);
  if (!ctx) fail(token, "invalid_link");

  await persistAndNotify({
    ctx,
    requestType: "data_access",
    payload: { notes: "" },
  });

  revalidatePath(`/preferences/${token}`);
  ok(token, "data_access");
}

export async function submitOther(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const ctx = await authorize(token);
  if (!ctx) fail(token, "invalid_link");

  const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000);
  if (!notes) fail(token, "missing_notes");

  await persistAndNotify({
    ctx,
    requestType: "other",
    payload: { notes },
  });

  revalidatePath(`/preferences/${token}`);
  ok(token, "other");
}
