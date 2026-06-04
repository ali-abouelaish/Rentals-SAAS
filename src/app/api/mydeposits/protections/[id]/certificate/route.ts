import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMdContext } from "@/lib/mydeposits/apiClient";
import { getDepositCertificate } from "@/lib/mydeposits/realityStone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireRole([...ADMIN_ROLES]);

  // RLS-scoped read confirms the protection belongs to the caller's tenant.
  const supabase = createSupabaseServerClient();
  const { data: protection } = await supabase
    .from("mydeposits_protections")
    .select("id, remote_deposit_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!protection || !protection.remote_deposit_id) {
    return NextResponse.json({ error: "Certificate not available" }, { status: 404 });
  }

  try {
    const ctx = await getMdContext(profile.tenant_id);
    const pdf = await getDepositCertificate(ctx, protection.remote_deposit_id, protection.id);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="deposit-certificate-${protection.id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("mydeposits certificate error:", err);
    return NextResponse.json({ error: "Failed to fetch certificate" }, { status: 502 });
  }
}
