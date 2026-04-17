import { NextRequest, NextResponse } from "next/server";
import { resolveSupportTenantFromRequest } from "@/features/support/data/resolveTenant";
import { getSupportBootstrap } from "@/features/support/data/queries";

export async function GET(request: NextRequest) {
  const tenant = await resolveSupportTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  try {
    const { properties } = await getSupportBootstrap(tenant.id);
    return NextResponse.json({
      company: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      properties,
    });
  } catch (err) {
    console.error("[support.bootstrap]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
