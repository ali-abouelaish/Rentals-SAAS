import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { getLandlords } from "@/features/landlords/data/landlords";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function LandlordsPage({
  searchParams
}: {
  searchParams?: { q?: string; paying?: string };
}) {
  const search = searchParams?.q ?? "";
  const paying = searchParams?.paying ?? "all";
  const landlords = await getLandlords({ search, paying });

  return (
    <div className="space-y-6">
      <PageHeader title="Landlords" subtitle="Manage partners & listings" />
      <Card>
        <CardContent>
          <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
            <div>
              <label className="text-xs text-gray-500">Search</label>
              <Input name="q" placeholder="Name, contact, email" defaultValue={search} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Paying</label>
              <select
                name="paying"
                defaultValue={paying}
                className="h-10 w-full rounded-xl border border-muted bg-card px-3 text-sm shadow-sm"
              >
                <option value="all">All</option>
                <option value="yes">Paying</option>
                <option value="no">Not paying</option>
              </select>
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
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
