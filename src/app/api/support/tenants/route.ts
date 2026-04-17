import { NextRequest, NextResponse } from "next/server";
import { resolveSupportTenantFromRequest } from "@/features/support/data/resolveTenant";
import { getSupportPmTenantsForUnit } from "@/features/support/data/queries";

export async function GET(request: NextRequest) {
  const tenant = await resolveSupportTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const unitId = request.nextUrl.searchParams.get("unitId");
  if (!unitId) {
    return NextResponse.json({ error: "missing_unit_id" }, { status: 400 });
  }

  try {
    const pmTenants = await getSupportPmTenantsForUnit(tenant.id, unitId);
    return NextResponse.json({ tenants: pmTenants });
  } catch (err) {
    console.error("[support.tenants]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
