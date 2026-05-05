import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserFromAccessTokenCookie } from "@/lib/auth/jwt";

export const runtime = "nodejs";

const STAFF_ROLES = new Set(["admin", "super_admin", "manager"]);

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = getUserFromAccessTokenCookie();
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role, tenant_id")
    .eq("id", decoded.id)
    .single();

  if (!profile || !STAFF_ROLES.has((profile.role ?? "").toLowerCase())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: ticket } = await admin
    .from("maintenance_tickets")
    .select("id, tenant_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!ticket || ticket.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await admin
    .from("maintenance_tickets")
    .update({ seen_by_landlord: true })
    .eq("id", params.id);

  if (error) {
    console.error("[maintenance.tickets.seen]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
