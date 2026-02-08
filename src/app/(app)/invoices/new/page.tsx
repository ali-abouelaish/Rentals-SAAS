import { PageHeader } from "@/components/layout/PageHeader";
import { getBillingProfiles } from "@/features/invoices/data/queries";
import { createInvoiceManual } from "@/features/invoices/actions/invoices";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoiceItemsForm } from "@/features/invoices/ui/InvoiceItemsForm";
import { Card, CardContent } from "@/components/ui/card";

export default async function NewInvoicePage() {
  const profiles = await getBillingProfiles();
  const supabase = createSupabaseServerClient();
  const { data: landlords } = await supabase
    .from("landlords")
    .select("id, name")
    .order("name", { ascending: true });

  if (profiles.length === 0 || (landlords?.length ?? 0) === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Invoice" subtitle="Create a manual invoice" />
        <Card>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p className="text-sm font-medium text-brand">Missing setup</p>
            {profiles.length === 0 ? (
              <p>Create at least one billing profile before invoicing.</p>
            ) : null}
            {(landlords?.length ?? 0) === 0 ? (
              <p>Add at least one landlord to send invoices to.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

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
