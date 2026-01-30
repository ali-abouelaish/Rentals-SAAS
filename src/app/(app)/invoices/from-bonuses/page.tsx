import { PageHeader } from "@/components/layout/PageHeader";
import { getBillingProfiles, getBonusesForInvoice } from "@/features/invoices/data/queries";
import { createInvoiceFromBonuses } from "@/features/invoices/actions/invoices";
import { InvoiceFromBonusesForm } from "@/features/invoices/ui/InvoiceFromBonusesForm";

export default async function InvoiceFromBonusesPage() {
  const [profiles, bonuses] = await Promise.all([
    getBillingProfiles(),
    getBonusesForInvoice()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Generate Invoice" subtitle="Create from landlord bonuses" />
      <InvoiceFromBonusesForm
        bonuses={bonuses}
        billingProfiles={profiles.map((profile) => ({
          id: profile.id,
          name: profile.name
        }))}
        onSubmit={createInvoiceFromBonuses}
      />
    </div>
  );
}
