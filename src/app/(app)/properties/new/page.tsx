import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { getOwnerLandlords, getPropertyManagers } from "@/features/properties/data/landlords";
import { CreatePropertyPage } from "@/features/properties/ui/CreatePropertyPage";

export default async function NewPropertyPage() {
  await requireRole([...ADMIN_ROLES]);
  // Let failures surface via the error boundary — swallowing them here would
  // render a misleading empty dropdown instead of an error.
  const [portfolios, ownerLandlords, propertyManagers] = await Promise.all([
    getPortfolios(),
    getOwnerLandlords(),
    getPropertyManagers(),
  ]);

  return (
    <CreatePropertyPage
      portfolios={portfolios}
      ownerLandlords={ownerLandlords}
      propertyManagers={propertyManagers}
    />
  );
}
