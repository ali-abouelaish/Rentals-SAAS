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
        const ids = parsed.filter((id) => typeof id === "string");
        const selectedBonuses = bonuses.filter((b) => ids.includes(b.id));
        if (selectedBonuses.length > 0) {
          const firstLandlordId = selectedBonuses[0].landlord_id;
          initialSelected = selectedBonuses
            .filter((b) => b.landlord_id === firstLandlordId)
            .map((b) => b.id);
        }
      }
    } catch {
      initialSelected = [];
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Generate Invoice" subtitle="Create from landlord bonuses" />
      <InvoiceFromBonusesForm
        bonuses={bonuses.map((b) => ({
          ...b,
          landlords: Array.isArray(b.landlords) ? b.landlords[0] : b.landlords
        }))}
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
