import { NextRequest, NextResponse } from "next/server";
import { resolveFlag } from "@/features/statements/actions/manage";

export async function PATCH(_req: NextRequest, { params }: { params: { flagId: string } }) {
  try {
    const result = await resolveFlag(params.flagId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Resolve failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resolve failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
