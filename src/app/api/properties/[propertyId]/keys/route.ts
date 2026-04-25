import { NextRequest, NextResponse } from "next/server";
import { AssertionError, assertKeyCreate } from "@/lib/auth/assertions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createKeysSchema } from "@/features/keys/domain/schemas";
import { getPropertyKeys } from "@/features/keys/data/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: { propertyId: string } }
) {
  try {
    const payload = await getPropertyKeys(params.propertyId);
    if (!payload) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/properties/keys][GET]", err);
    return NextResponse.json({ error: "Failed to load keys" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { propertyId: string } }
) {
  try {
    const json = await req.json();
    const parsed = createKeysSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    // Validate every target up front. assertKeyCreate handles role + tenant scope.
    for (const k of parsed.data.keys) {
      await assertKeyCreate({ propertyId: params.propertyId, unitId: k.unitId ?? null });
    }
    const actor = await assertKeyCreate({ propertyId: params.propertyId });

    const supabase = createSupabaseServerClient();
    const rows = parsed.data.keys.map((k) => ({
      tenant_id: actor.tenantId,
      property_id: k.unitId ? null : params.propertyId,
      unit_id: k.unitId ?? null,
      set_name: k.setName,
      copy_label: k.copyLabel,
      notes: k.notes ?? null,
    }));

    const { data, error } = await supabase
      .from("keys")
      .insert(rows)
      .select("id");

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A key with that label already exists in this set" },
          { status: 409 }
        );
      }
      console.error("[api/properties/keys][POST] insert", error);
      return NextResponse.json({ error: "Failed to register keys" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ids: (data ?? []).map((r) => r.id) }, { status: 201 });
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/properties/keys][POST]", err);
    return NextResponse.json({ error: "Failed to register keys" }, { status: 500 });
  }
}
