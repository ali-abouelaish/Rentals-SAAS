import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPropertyById } from "@/features/properties/data/properties";
import { getUnitsByProperty } from "@/features/properties/data/units";
import { getAllPropertyPhotos } from "@/features/properties/data/photos";
import { PropertyDetailPage } from "@/features/properties/ui/PropertyDetailPage";

export default async function PropertyDetailRoute({
  params,
}: {
  params: { id: string };
}) {
  await requireRole([...ADMIN_ROLES]);

  const [property, units, allPhotos] = await Promise.all([
    getPropertyById(params.id),
    getUnitsByProperty(params.id),
    getAllPropertyPhotos(params.id),
  ]);

  if (!property) notFound();

  return (
    <PropertyDetailPage
      property={property}
      initialUnits={units}
      allPhotos={allPhotos}
    />
  );
}
