import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { getLandlordById } from "@/features/landlords/data/landlords";

export default async function LandlordDetailPage({
  params
}: {
  params: { id: string };
}) {
  const { landlord, rentalsCount, listings } = await getLandlordById(params.id);

  return (
    <div className="space-y-6">
      <PageHeader title={landlord.name} subtitle="Landlord detail" />
      <Card>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm text-gray-600">
          <div>
            <p className="text-xs uppercase text-gray-400">Contact</p>
            <p>{landlord.contact ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">Email</p>
            <p>{landlord.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">Times rented from</p>
            <p>{rentalsCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium text-navy">Scraped listings</p>
          <DataTable
            columns={["Title", "Price", "Postcode", "Active"]}
            rows={listings.map((listing) => [
              <span key={`${listing.id}-title`}>{listing.title}</span>,
              <span key={`${listing.id}-price`}>£{listing.price}</span>,
              <span key={`${listing.id}-postcode`}>{listing.postcode}</span>,
              <span key={`${listing.id}-active`}>{listing.is_active ? "Yes" : "No"}</span>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
