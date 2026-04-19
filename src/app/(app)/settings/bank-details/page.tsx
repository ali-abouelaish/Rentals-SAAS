import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getBankDetails } from "@/features/booking-forms/data/bank-details";
import { BankDetailsForm } from "@/features/booking-forms/ui/BankDetailsForm";

export default async function BankDetailsSettingsPage() {
  await requireRole([...ADMIN_ROLES]);
  const details = await getBankDetails();

  return <BankDetailsForm initial={details} />;
}
