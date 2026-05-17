import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { authorizeSession } from "@/lib/enablebanking";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

function fail(reason: string): NextResponse {
  const target = new URL("/demo/open-banking", appUrl() || "http://localhost:3000");
  target.searchParams.set("error", reason);
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const profile = await requireUserProfile();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("missing_code_or_state");

  const admin = createSupabaseAdminClient();

  // State == ob_connections.id. Verify it belongs to the signed-in tenant
  // before doing anything with EB.
  const { data: connection } = await admin
    .from("ob_connections")
    .select("id, tenant_id, status")
    .eq("id", state)
    .maybeSingle();
  if (!connection || connection.tenant_id !== profile.tenant_id) {
    return fail("invalid_state");
  }

  try {
    const session = await authorizeSession(code);

    await admin
      .from("ob_connections")
      .update({
        status: "authorized",
        eb_session_id: session.session_id,
        valid_until: session.access?.valid_until ?? null
      })
      .eq("id", connection.id);

    if (session.accounts?.length) {
      const rows = session.accounts.map((a) => ({
        connection_id: connection.id,
        tenant_id: profile.tenant_id,
        eb_account_uid: a.uid,
        iban: a.account_id?.iban ?? a.account_id?.other?.identification ?? null,
        account_name: a.name ?? a.product ?? null,
        currency: a.currency ?? null
      }));
      await admin
        .from("ob_accounts")
        .upsert(rows, { onConflict: "connection_id,eb_account_uid" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "callback_failed";
    return fail(encodeURIComponent(message.slice(0, 200)));
  }

  const target = new URL("/demo/open-banking", appUrl() || "http://localhost:3000");
  target.searchParams.set("connected", "true");
  return NextResponse.redirect(target);
}
