import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });

  // Auth check — must be a signed-in admin for this tenant
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes((profile.role ?? "").toLowerCase())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Ensure the path belongs to this tenant (first segment is tenant_id)
  const [pathTenantId] = path.split("/");
  if (pathTenantId !== profile.tenant_id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from("form-uploads")
    .createSignedUrl(path, 60 * 60); // 1-hour signed URL

  if (error || !data?.signedUrl) {
    return new NextResponse("File not found", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
