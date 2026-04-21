import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getBookingForms } from "@/features/booking-forms/data/booking-forms";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { FormBuilderPage } from "@/features/booking-forms/ui/FormBuilderPage";
import { buildTenantAppUrl } from "@/lib/urls";

export default async function BookingFormsSettingsPage() {
  await requireRole([...ADMIN_ROLES]);

  const [forms, portfolios] = await Promise.all([
    getBookingForms(),
    getPortfolios(),
  ]);

  const appUrl = buildTenantAppUrl(headers());

  return (
    <FormBuilderPage
      initialForms={forms}
      portfolios={portfolios}
      appUrl={appUrl}
    />
  );
}
