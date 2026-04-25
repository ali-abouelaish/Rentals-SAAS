import { NextRequest, NextResponse } from "next/server";
import { AssertionError, assertKeyMutate } from "@/lib/auth/assertions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkinSchema } from "@/features/keys/domain/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = checkinSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { key, actor } = await assertKeyMutate(params.keyId);

    if (key.status !== "loaned" && key.status !== "with_tenant") {
      return NextResponse.json(
        { error: "Key is not currently checked out" },
        { status: 409 }
      );
    }

    const supabase = createSupabaseServerClient();

    const { data: open, error: openErr } = await supabase
      .from("key_assignments")
      .select("id")
      .eq("key_id", key.id)
      .is("returned_at", null)
      .limit(1)
      .maybeSingle();

    if (openErr) {
      console.error("[api/keys/checkin] open lookup", openErr);
      return NextResponse.json({ error: "Failed to check in key" }, { status: 500 });
    }
    if (!open) {
      return NextResponse.json({ error: "No open assignment to close" }, { status: 409 });
    }

    const condition = parsed.data.returnedCondition ?? "good";

    const { error: closeErr } = await supabase
      .from("key_assignments")
      .update({
        returned_at: new Date().toISOString(),
        returned_condition: condition,
        checked_in_by: actor.userId,
        notes: parsed.data.notes ?? undefined,
      })
      .eq("id", open.id);

    if (closeErr) {
      console.error("[api/keys/checkin] close", closeErr);
      return NextResponse.json({ error: "Failed to check in key" }, { status: 500 });
    }

    const newStatus = condition === "lost" ? "lost" : "in_office";
    const { error: statusErr } = await supabase
      .from("keys")
      .update({ status: newStatus })
      .eq("id", key.id);

    if (statusErr) {
      console.error("[api/keys/checkin] status update", statusErr);
      return NextResponse.json({ error: "Failed to update key status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/keys/checkin]", err);
    return NextResponse.json({ error: "Failed to check in key" }, { status: 500 });
  }
}
