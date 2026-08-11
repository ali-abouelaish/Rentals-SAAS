import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES, isAdminRole } from "@/lib/auth/roles";
import { getPropertyById } from "@/features/properties/data/properties";
import { getUnitsByProperty } from "@/features/properties/data/units";
import { getAllPropertyPhotos } from "@/features/properties/data/photos";
import { getOwnerLandlordContact } from "@/features/properties/data/landlords";
import { getPropertyTenantHistory } from "@/features/contracts/data/tenant-history";
import { getPmTenants } from "@/features/pm-tenants/data/pm-tenants";
import { getActiveForms } from "@/features/forms/data/forms";
import { PropertyDetailPage } from "@/features/properties/ui/PropertyDetailPage";
import { TrackEntityVisit } from "@/features/search/ui/TrackEntityVisit";
import {
  getInternalAgentsForTenant,
  getPropertyKeys,
} from "@/features/keys/data/queries";
import { getCertificatesForProperty } from "@/features/certificates/data/certificates";
import { getAllSuppliers } from "@/features/maintenance/data/suppliers";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { AddReminderDialog } from "@/features/automations/ui/AddReminderDialog";

export default async function PropertyDetailRoute({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const entitlements = await getEntitlements();
  const keysEnabled = entitlements.has("keys");
  const certificatesEnabled = entitlements.has("certificates");

  const [
    property,
    units,
    allPhotos,
    tenantHistory,
    keysPayload,
    agents,
    pmTenantsData,
    forms,
    certificates,
    suppliers,
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
    certificatesEnabled
      ? getCertificatesForProperty(params.id)
      : Promise.resolve([]),
    certificatesEnabled ? getAllSuppliers().catch(() => []) : Promise.resolve([]),
  ]);

  if (!property) notFound();

  // Contact details for the landlord contract card — the property query only
  // joins the owner's id and name.
  const landlord = property.owner_landlord_id
    ? await getOwnerLandlordContact(property.owner_landlord_id)
    : null;

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
      {entitlements.has("automations") && (
        <div className="flex justify-end mb-2">
          <AddReminderDialog
            entity={{
              type: "property",
              id: property.id,
              label: property.address_line_1 ?? property.name,
            }}
          />
        </div>
      )}
      <PropertyDetailPage
        property={property}
        landlord={landlord}
        initialUnits={units}
        allPhotos={allPhotos}
        tenantHistory={tenantHistory}
        canCloseout={isAdminRole(profile.role)}
        keysPayload={keysPayload}
        agents={agents}
        keysEnabled={keysEnabled}
        pmTenants={pmTenants}
        forms={forms}
        certificatesEnabled={certificatesEnabled}
        certificates={certificates}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        ownerRecordEnabled={entitlements.has("owner_statements")}
      />
    </>
  );
}
