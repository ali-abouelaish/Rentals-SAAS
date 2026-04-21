import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getAllBankDetailsForTenant } from "@/features/booking-forms/data/bank-details";
import { getBookingForms } from "@/features/booking-forms/data/booking-forms";
import { BankDetailsForm } from "@/features/booking-forms/ui/BankDetailsForm";

export default async function BankDetailsSettingsPage() {
  await requireRole([...ADMIN_ROLES]);

  const [forms, allDetails] = await Promise.all([
    getBookingForms(),
    getAllBankDetailsForTenant(),
  ]);

  const detailsByFormId = Object.fromEntries(allDetails.map((d) => [d.form_id, d]));

  return <BankDetailsForm forms={forms} detailsByFormId={detailsByFormId} />;
}
