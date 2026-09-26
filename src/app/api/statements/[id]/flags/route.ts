import { NextRequest, NextResponse } from "next/server";
import { getUploadFlags } from "@/features/statements/data/queries";
import { rethrowIfNextControlFlow } from "@/lib/auth/assertions";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const flags = await getUploadFlags(params.id);
    return NextResponse.json(flags);
  } catch (err) {
    rethrowIfNextControlFlow(err);
    const message = err instanceof Error ? err.message : "Failed to load flags";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
