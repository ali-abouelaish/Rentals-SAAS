import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { startAuth } from "@/lib/enablebanking";

const bodySchema = z.object({
  aspsp_name: z.string().min(1),
  aspsp_country: z.string().min(2).max(2).default("GB")
});

export async function POST(request: NextRequest) {
  const profile = await requireUserProfile();
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { aspsp_name, aspsp_country } = parsed.data;

  const admin = createSupabaseAdminClient();
  // Insert with the user's tenant_id baked in — RLS would also enforce this
  // for the SSR client, but the admin client is what reaches EB; we scope
  // manually to keep the data tenant-isolated.
  const { data: connection, error } = await admin
    .from("ob_connections")
    .insert({
      tenant_id: profile.tenant_id,
      aspsp_name,
      aspsp_country,
      status: "pending"
    })
    .select("id")
    .single();

  if (error || !connection) {
    return NextResponse.json({ error: error?.message ?? "Failed to create connection" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const redirectUrl = `${appUrl}/api/open-banking/callback`;

  try {
    const { url, authorization_id } = await startAuth(
      aspsp_name,
      aspsp_country,
      redirectUrl,
      connection.id
    );
    await admin
      .from("ob_connections")
      .update({ eb_authorization_id: authorization_id })
      .eq("id", connection.id);
    return NextResponse.json({ url, connection_id: connection.id });
  } catch (err) {
    await admin.from("ob_connections").delete().eq("id", connection.id);
    const message = err instanceof Error ? err.message : "Failed to start auth";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
