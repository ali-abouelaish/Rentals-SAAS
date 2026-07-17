import { notFound, redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { resolvePortalTenant } from "@/features/portal/data/resolve";
import {
  getPortalContracts,
  getPortalDeposit,
  getPortalPmTenant,
  getPortalRent,
  getPortalTickets,
} from "@/features/portal/data/queries";
import { PortalDashboard } from "@/features/portal/ui/PortalDashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  searchParams: { companySlug?: string; err?: string };
};

export default async function PortalPage({ searchParams }: PageProps) {
  const companySlug = searchParams.companySlug ?? null;
  const slugSuffix = companySlug
    ? `?companySlug=${encodeURIComponent(companySlug)}`
    : "";

  const tenant = await resolvePortalTenant(companySlug);
  if (!tenant) notFound();

  const session = getPortalSession();
  if (!session || session.tenantId !== tenant.id) {
    redirect(`/portal/login${slugSuffix}`);
  }

  const [pmTenant, contracts, tickets] = await Promise.all([
    getPortalPmTenant(tenant.id, session.pmTenantId),
    getPortalContracts(tenant.id, session.pmTenantId),
    getPortalTickets(tenant.id, session.pmTenantId),
  ]);

  // The renter record was deleted since the session was minted.
  if (!pmTenant) redirect(`/portal/login${slugSuffix}`);

  const blocks = await Promise.all(
    contracts.map(async (c) => ({
      tenancy: c.tenancy,
      rent: c.tenancy.ended ? null : await getPortalRent(tenant.id, c.raw),
      deposit: await getPortalDeposit(tenant.id, c.raw),
    }))
  );

  return (
    <PortalDashboard
      agency={{
        name: tenant.branding?.brand_name?.trim() || tenant.name,
        email: tenant.contactEmail,
        phone: tenant.alertPhone,
      }}
      pmTenant={pmTenant}
      blocks={blocks}
      tickets={tickets}
      errorCode={searchParams.err ?? null}
      slugSuffix={slugSuffix}
    />
  );
}
