import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { buildAuthUrl } from "@/lib/gmail/oauthClient";

export async function GET() {
  const profile = await requireRole([...ADMIN_ROLES]);
  const authUrl = buildAuthUrl(profile.tenant_id);
  return NextResponse.redirect(authUrl);
}
