import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES, isAdminRole } from "@/lib/auth/roles";
import { getPropertyById } from "@/features/properties/data/properties";
import { getUnitsByProperty } from "@/features/properties/data/units";
import { getAllPropertyPhotos } from "@/features/properties/data/photos";
import { getPropertyTenantHistory } from "@/features/contracts/data/tenant-history";
import { getPmTenants } from "@/features/pm-tenants/data/pm-tenants";
import { getActiveForms } from "@/features/forms/data/forms";
import { PropertyDetailPage } from "@/features/properties/ui/PropertyDetailPage";
import { TrackEntityVisit } from "@/features/search/ui/TrackEntityVisit";
import {
  getInternalAgentsForTenant,
  getPropertyKeys,
} from "@/features/keys/data/queries";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";

export default async function PropertyDetailRoute({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const entitlements = await getEntitlements();
  const keysEnabled = entitlements.has("keys");

  const [
    property,
    units,
    allPhotos,
    tenantHistory,
    keysPayload,
    agents,
    pmTenantsData,
    forms,
  ] = await Promise.all([
    getPropertyById(params.id),
    getUnitsByProperty(params.id),
    getAllPropertyPhotos(params.id),
    getPropertyTenantHistory(params.id),
    keysEnabled ? getPropertyKeys(params.id) : Promise.resolve(null),
    keysEnabled
      ? getInternalAgentsForTenant(profile.tenant_id)
      : Promise.resolve([]),
    getPmTenants().catch(() => []),
    getActiveForms().catch(() => []),
  ]);

  if (!property) notFound();

  const pmTenants = pmTenantsData.map((t) => ({
    id: t.id,
    full_name: t.full_name,
    email: t.email,
    phone: t.phone,
  }));

  return (
    <>
      <TrackEntityVisit
        tenantId={profile.tenant_id}
        kind="property"
        id={property.id}
        title={property.address_line_1 ?? property.name}
        subtitle={property.postcode ?? property.area ?? null}
        href={`/properties/${property.id}`}
      />
      <PropertyDetailPage
        property={property}
        initialUnits={units}
        allPhotos={allPhotos}
        tenantHistory={tenantHistory}
        canCloseout={isAdminRole(profile.role)}
        keysPayload={keysPayload}
        agents={agents}
        keysEnabled={keysEnabled}
        pmTenants={pmTenants}
        forms={forms}
      />
    </>
  );
}
