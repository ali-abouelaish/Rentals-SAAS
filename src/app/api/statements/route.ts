import { NextRequest, NextResponse } from "next/server";
import { listStatementUploads } from "@/features/statements/data/queries";

export async function GET(_req: NextRequest) {
  try {
    const uploads = await listStatementUploads();
    return NextResponse.json({ uploads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load statements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
