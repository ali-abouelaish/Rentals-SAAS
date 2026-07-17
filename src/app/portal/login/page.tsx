import { notFound, redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { resolvePortalTenant } from "@/features/portal/data/resolve";
import { PortalLoginForm } from "@/features/portal/ui/PortalLoginForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  searchParams: { companySlug?: string; err?: string };
};

export default async function PortalLoginPage({ searchParams }: PageProps) {
  const companySlug = searchParams.companySlug ?? null;
  const slugSuffix = companySlug
    ? `?companySlug=${encodeURIComponent(companySlug)}`
    : "";

  const tenant = await resolvePortalTenant(companySlug);
  if (!tenant) notFound();

  const session = getPortalSession();
  if (session && session.tenantId === tenant.id) {
    redirect(`/portal${slugSuffix}`);
  }

  return (
    <PortalLoginForm
      agencyName={tenant.branding?.brand_name?.trim() || tenant.name}
      companySlug={companySlug}
      linkExpired={searchParams.err === "expired"}
    />
  );
}
