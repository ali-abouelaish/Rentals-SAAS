import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTdsContext } from "@/lib/tds/context";
import { getDpcCertificate } from "@/lib/tds/deposits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireRole([...ADMIN_ROLES]);

  // RLS-scoped read confirms the deposit belongs to the caller's tenant.
  const supabase = createSupabaseServerClient();
  const { data: deposit } = await supabase
    .from("tds_deposits")
    .select("id, dan")
    .eq("id", params.id)
    .maybeSingle();

  if (!deposit || !deposit.dan) {
    return NextResponse.json({ error: "Certificate not available" }, { status: 404 });
  }

  try {
    const ctx = await getTdsContext(profile.tenant_id);
    const pdf = await getDpcCertificate(ctx, deposit.dan as string, deposit.id as string);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tds-dpc-${deposit.id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("TDS certificate error:", err);
    return NextResponse.json({ error: "Failed to fetch certificate" }, { status: 502 });
  }
}
