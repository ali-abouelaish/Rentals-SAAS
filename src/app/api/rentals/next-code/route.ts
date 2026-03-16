import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";

export async function GET(_request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();

  const { data: codeData, error } = await supabase.rpc("peek_rental_code", {
    p_tenant_id: profile.tenant_id
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ code: codeData }, { status: 200 });
}

