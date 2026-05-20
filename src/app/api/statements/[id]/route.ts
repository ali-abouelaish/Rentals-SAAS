import { NextRequest, NextResponse } from "next/server";
import { deleteUpload } from "@/features/statements/actions/manage";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await deleteUpload(params.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Delete failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
