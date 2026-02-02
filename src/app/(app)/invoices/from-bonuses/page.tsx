import { PageHeader } from "@/components/layout/PageHeader";
import { getBillingProfiles, getBonusesForInvoice } from "@/features/invoices/data/queries";
import { createInvoiceFromBonuses } from "@/features/invoices/actions/invoices";
import { InvoiceFromBonusesForm } from "@/features/invoices/ui/InvoiceFromBonusesForm";

export default async function InvoiceFromBonusesPage({
  searchParams
}: {
  searchParams?: { bonus_ids?: string };
}) {
  const [profiles, bonuses] = await Promise.all([
    getBillingProfiles(),
    getBonusesForInvoice()
  ]);

  let initialSelected: string[] = [];
  if (searchParams?.bonus_ids) {
    try {
      const parsed = JSON.parse(searchParams.bonus_ids);
      if (Array.isArray(parsed)) {
        initialSelected = parsed.filter((id) => typeof id === "string");
      }
    } catch {
      initialSelected = [];
    }
  }

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
        initialSelected={initialSelected}
        lockSelection={initialSelected.length > 0}
      />
    </div>
  );
}
