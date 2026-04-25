import { NextRequest, NextResponse } from "next/server";
import { AssertionError, assertKeyAccess } from "@/lib/auth/assertions";
import { getKeyHistory } from "@/features/keys/data/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    await assertKeyAccess(params.keyId);
    const history = await getKeyHistory(params.keyId);
    return NextResponse.json({ history });
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/keys/history]", err);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
