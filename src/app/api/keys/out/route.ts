import { NextRequest, NextResponse } from "next/server";
import { AssertionError, assertKeysDashboardRead } from "@/lib/auth/assertions";
import { getKeysOutForTenant } from "@/features/keys/data/queries";

export async function GET(_req: NextRequest) {
  try {
    const { tenantId } = await assertKeysDashboardRead();
    const items = await getKeysOutForTenant(tenantId);
    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/keys/out]", err);
    return NextResponse.json({ error: "Failed to load keys out" }, { status: 500 });
  }
}
