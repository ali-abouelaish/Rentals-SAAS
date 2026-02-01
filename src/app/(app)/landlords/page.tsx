import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { getLandlords } from "@/features/landlords/data/landlords";

export default async function LandlordsPage() {
  const landlords = await getLandlords();

  return (
    <div className="space-y-6">
      <PageHeader title="Landlords" subtitle="Manage partners & listings" />
      <Card>
        <CardContent>
          <DataTable
            columns={["Name", "Contact", "Paying", "Actions"]}
            rows={landlords.map((landlord) => [
              <span key={`${landlord.id}-name`} className="text-sm text-navy">
                {landlord.name}
              </span>,
              <span key={`${landlord.id}-contact`} className="text-sm text-gray-600">
                {landlord.contact ?? landlord.email ?? "—"}
              </span>,
              <span key={`${landlord.id}-paying`} className="text-sm text-gray-600">
                {landlord.pays_commission
                  ? `Yes · ${
                      landlord.commission_term_text?.trim().length
                        ? landlord.commission_term_text
                        : `£${Number(landlord.commission_amount_gbp ?? 0).toFixed(2)}`
                    }`
                  : "No"}
              </span>,
              <Link key={`${landlord.id}-link`} href={`/landlords/${landlord.id}`} className="text-navy">
                View
              </Link>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
