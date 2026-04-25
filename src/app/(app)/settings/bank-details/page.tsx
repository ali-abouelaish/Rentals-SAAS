import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getAllBankDetailsForTenant } from "@/features/booking-forms/data/bank-details";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { BankDetailsForm } from "@/features/booking-forms/ui/BankDetailsForm";

export default async function BankDetailsSettingsPage() {
  await requireRole([...ADMIN_ROLES]);

  const [portfolios, allDetails] = await Promise.all([
    getPortfolios(),
    getAllBankDetailsForTenant(),
  ]);

  return <BankDetailsForm portfolios={portfolios} bankDetails={allDetails} />;
}
