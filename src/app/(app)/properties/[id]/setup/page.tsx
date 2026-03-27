import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPropertyById } from "@/features/properties/data/properties";
import { getUnitsByProperty } from "@/features/properties/data/units";
import { getPropertyPhotos } from "@/features/properties/data/photos";
import { PropertySetupPage } from "@/features/properties/ui/PropertySetupPage";

export default async function PropertySetupRoute({
  params,
}: {
  params: { id: string };
}) {
  await requireRole([...ADMIN_ROLES]);

  const [property, units, propertyPhotos] = await Promise.all([
    getPropertyById(params.id),
    getUnitsByProperty(params.id),
    getPropertyPhotos(params.id),
  ]);

  if (!property) notFound();

  return (
    <PropertySetupPage
      property={property}
      initialUnits={units}
      initialPropertyPhotos={propertyPhotos}
    />
  );
}
