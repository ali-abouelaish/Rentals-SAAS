import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getTenantBillingInfo } from "@/features/billing-info/data/queries";
import { BillingInfoForm } from "@/features/billing-info/ui/BillingInfoForm";

export default async function BillingInfoPage() {
  await requireRole([...ADMIN_ROLES]);
  const info = await getTenantBillingInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing info"
        subtitle="Subscription, payment status and billing contact for your account"
      />
      <BillingInfoForm info={info} />
    </div>
  );
}
