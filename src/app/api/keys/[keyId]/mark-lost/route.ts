import { NextRequest, NextResponse } from "next/server";
import { AssertionError, assertKeyMutate } from "@/lib/auth/assertions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const { key, actor } = await assertKeyMutate(params.keyId);

    if (key.status === "destroyed") {
      return NextResponse.json({ error: "Key is already destroyed" }, { status: 409 });
    }

    const supabase = createSupabaseServerClient();

    const nowIso = new Date().toISOString();
    const { error: closeErr } = await supabase
      .from("key_assignments")
      .update({
        returned_at: nowIso,
        returned_condition: "lost",
        checked_in_by: actor.userId,
      })
      .eq("key_id", key.id)
      .is("returned_at", null);

    if (closeErr) {
      console.error("[api/keys/mark-lost] close", closeErr);
      return NextResponse.json({ error: "Failed to mark key lost" }, { status: 500 });
    }

    const { error: statusErr } = await supabase
      .from("keys")
      .update({ status: "lost" })
      .eq("id", key.id);

    if (statusErr) {
      console.error("[api/keys/mark-lost] status update", statusErr);
      return NextResponse.json({ error: "Failed to mark key lost" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "lost" });
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/keys/mark-lost]", err);
    return NextResponse.json({ error: "Failed to mark key lost" }, { status: 500 });
  }
}
