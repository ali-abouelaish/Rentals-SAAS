import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMaintenanceTicket } from "@/features/maintenance/data/tickets";

export const runtime = "nodejs";

const STAFF_ROLES = new Set(["admin", "super_admin", "manager"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role")
    .eq("id", session.user.id)
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
