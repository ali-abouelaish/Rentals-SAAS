import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getBookingForms } from "@/features/booking-forms/data/booking-forms";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { FormBuilderPage } from "@/features/booking-forms/ui/FormBuilderPage";

export default async function BookingFormsSettingsPage() {
  await requireRole([...ADMIN_ROLES]);

  const [forms, portfolios] = await Promise.all([
    getBookingForms(),
    getPortfolios(),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <FormBuilderPage
      initialForms={forms}
      portfolios={portfolios}
      appUrl={appUrl}
    />
  );
}
