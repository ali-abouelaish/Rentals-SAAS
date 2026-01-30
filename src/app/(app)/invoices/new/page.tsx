import { PageHeader } from "@/components/layout/PageHeader";
import { getBillingProfiles } from "@/features/invoices/data/queries";
import { createInvoiceManual } from "@/features/invoices/actions/invoices";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoiceItemsForm } from "@/features/invoices/ui/InvoiceItemsForm";

export default async function NewInvoicePage() {
  const profiles = await getBillingProfiles();
  const supabase = createSupabaseServerClient();
  const { data: landlords } = await supabase
    .from("landlords")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader title="New Invoice" subtitle="Create a manual invoice" />
      <InvoiceItemsForm
        billingProfiles={profiles.map((profile) => ({
          id: profile.id,
          name: profile.name
        }))}
        landlords={(landlords ?? []).map((landlord) => ({
          id: landlord.id,
          name: landlord.name
        }))}
        onSubmit={createInvoiceManual}
      />
    </div>
  );
}
