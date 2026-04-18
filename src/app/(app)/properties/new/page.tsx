import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { getOwnerLandlords, getPropertyManagers } from "@/features/properties/data/landlords";
import { CreatePropertyPage } from "@/features/properties/ui/CreatePropertyPage";

export default async function NewPropertyPage() {
  await requireRole([...ADMIN_ROLES]);
  const [portfolios, ownerLandlords, propertyManagers] = await Promise.all([
    getPortfolios().catch(() => []),
    getOwnerLandlords().catch(() => []),
    getPropertyManagers().catch(() => []),
  ]);

  return (
    <CreatePropertyPage
      portfolios={portfolios}
      ownerLandlords={ownerLandlords}
      propertyManagers={propertyManagers}
    />
  );
}
