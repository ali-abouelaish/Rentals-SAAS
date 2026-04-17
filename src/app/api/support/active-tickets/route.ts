import { NextRequest, NextResponse } from "next/server";
import { resolveSupportTenantFromRequest } from "@/features/support/data/resolveTenant";
import { getSupportActiveTickets } from "@/features/support/data/queries";

export async function GET(request: NextRequest) {
  const tenant = await resolveSupportTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const pmTenantId = request.nextUrl.searchParams.get("tenantId");
  if (!pmTenantId) {
    return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });
  }

  try {
    const tickets = await getSupportActiveTickets(tenant.id, pmTenantId);
    return NextResponse.json({ tickets });
  } catch (err) {
    console.error("[support.active-tickets]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
