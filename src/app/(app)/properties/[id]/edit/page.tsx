import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPropertyById } from "@/features/properties/data/properties";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { getOwnerLandlords } from "@/features/properties/data/landlords";
import { CreatePropertyPage } from "@/features/properties/ui/CreatePropertyPage";

export default async function PropertyEditRoute({
  params,
}: {
  params: { id: string };
}) {
  await requireRole([...ADMIN_ROLES]);

  const [property, portfolios, ownerLandlords] = await Promise.all([
    getPropertyById(params.id),
    getPortfolios(),
    getOwnerLandlords().catch(() => []),
  ]);

  if (!property) notFound();

  return (
    <CreatePropertyPage
      portfolios={portfolios}
      initialProperty={property}
      ownerLandlords={ownerLandlords}
    />
  );
}
