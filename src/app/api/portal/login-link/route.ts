import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientIpFromHeaders } from "@/features/property-shares/lib/rate-limit";
import { resolvePortalTenantFromRequest } from "@/features/portal/data/resolve";
import { requestPortalLoginLink } from "@/features/portal/actions/request-login-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export async function POST(request: NextRequest) {
  const tenant = await resolvePortalTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Unknown workspace" }, { status: 404 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // fall through to schema failure
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address" },
      { status: 400 }
    );
  }

  const hostname = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
  const isLocal = hostname === "localhost" || hostname.startsWith("127.");

  await requestPortalLoginLink({
    tenant,
    email: parsed.data.email,
    ip: clientIpFromHeaders(request),
    devBaseUrl: isLocal ? request.nextUrl.origin : null,
  });

  // Deliberately identical response whether or not the email matched a
  // renter — this endpoint must not leak who rents through the agency.
  return NextResponse.json({ ok: true });
}
