import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserFromAccessTokenCookie } from "@/lib/auth/jwt";
import { getMaintenanceTicket } from "@/features/maintenance/data/tickets";

export const runtime = "nodejs";

const STAFF_ROLES = new Set(["admin", "super_admin", "manager"]);

export async function GET(
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
    .select("id, role")
    .eq("id", decoded.id)
    .single();

  if (!profile || !STAFF_ROLES.has((profile.role ?? "").toLowerCase())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ticket = await getMaintenanceTicket(params.id);
  if (!ticket) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}
