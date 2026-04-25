import { NextRequest, NextResponse } from "next/server";
import { AssertionError, assertKeyMutate } from "@/lib/auth/assertions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const { key } = await assertKeyMutate(params.keyId);

    if (key.status === "loaned" || key.status === "with_tenant") {
      return NextResponse.json(
        { error: "Check the key in before deleting it" },
        { status: 409 }
      );
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("keys").delete().eq("id", key.id);
    if (error) {
      console.error("[api/keys][DELETE]", error);
      return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/keys][DELETE]", err);
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }
}
