import { NextRequest, NextResponse } from "next/server";
import { AssertionError, assertKeyMutate } from "@/lib/auth/assertions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/features/keys/domain/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const json = await req.json();
    const parsed = checkoutSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { key, actor } = await assertKeyMutate(params.keyId);

    if (key.status !== "in_office") {
      return NextResponse.json(
        { error: `Key is currently ${key.status.replace("_", " ")} and cannot be checked out` },
        { status: 409 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Defensive: confirm there is no open assignment. RLS plus the 'in_office'
    // status check above should make this impossible, but the partial unique
    // index isn't in the DB so we guard here.
    const { data: open, error: openErr } = await supabase
      .from("key_assignments")
      .select("id")
      .eq("key_id", key.id)
      .is("returned_at", null)
      .limit(1);

    if (openErr) {
      console.error("[api/keys/checkout] open lookup", openErr);
      return NextResponse.json({ error: "Failed to check out key" }, { status: 500 });
    }
    if (open && open.length > 0) {
      return NextResponse.json(
        { error: "Key already has an open assignment" },
        { status: 409 }
      );
    }

    const newStatus = parsed.data.purpose === "tenancy" ? "with_tenant" : "loaned";

    const { error: insertErr } = await supabase.from("key_assignments").insert({
      tenant_id: actor.tenantId,
      key_id: key.id,
      held_by_user_id: parsed.data.heldByUserId ?? null,
      held_by_contact_name: parsed.data.heldByContactName ?? null,
      held_by_contact_phone: parsed.data.heldByContactPhone ?? null,
      purpose: parsed.data.purpose,
      notes: parsed.data.notes ?? null,
      expected_return_at: parsed.data.expectedReturnAt ?? null,
      checked_out_by: actor.userId,
    });

    if (insertErr) {
      console.error("[api/keys/checkout] insert", insertErr);
      return NextResponse.json({ error: "Failed to check out key" }, { status: 500 });
    }

    const { error: updateErr } = await supabase
      .from("keys")
      .update({ status: newStatus })
      .eq("id", key.id);

    if (updateErr) {
      console.error("[api/keys/checkout] status update", updateErr);
      return NextResponse.json({ error: "Failed to update key status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/keys/checkout]", err);
    return NextResponse.json({ error: "Failed to check out key" }, { status: 500 });
  }
}
