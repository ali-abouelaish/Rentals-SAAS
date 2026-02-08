import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { FilterBar, FilterRow, FilterGroup, FilterActions } from "@/components/ui/filter-bar";
import { getLandlords } from "@/features/landlords/data/landlords";
import { Building, ExternalLink, Check, X } from "lucide-react";

export default async function LandlordsPage({
  searchParams
}: {
  searchParams?: { q?: string; paying?: string };
}) {
  const search = searchParams?.q ?? "";
  const paying = searchParams?.paying ?? "all";
  const landlords = await getLandlords({ search, paying });

  const payingOptions = [
    { value: "all", label: "All" },
    { value: "yes", label: "Paying" },
    { value: "no", label: "Not Paying" }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Landlords"
        subtitle="Manage partners & listings"
      />

      {/* Filter Bar */}
      <FilterBar>
        <form method="get">
          <FilterRow>
            <FilterGroup label="Search">
              <Input
                name="q"
                placeholder="Name, contact, email..."
                defaultValue={search}
                className="w-64"
              />
            </FilterGroup>
            <FilterGroup label="Payment Status">
              <select
                name="paying"
                defaultValue={paying}
                className="flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm border-slate-200 text-slate-700"
              >
                {payingOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterActions>
              <Button type="submit" variant="outline" size="sm">
                Apply
              </Button>
            </FilterActions>
          </FilterRow>
        </form>
      </FilterBar>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing <span className="font-medium text-slate-700">{landlords.length}</span> landlords
        </p>
      </div>

      {/* Landlords Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Pays Commission</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {landlords.map((landlord) => (
            <TableRow key={landlord.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Building className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="font-medium text-slate-700">{landlord.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-slate-600">
                {landlord.contact ?? landlord.email ?? "—"}
              </TableCell>
              <TableCell>
                {landlord.pays_commission ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <Check className="h-4 w-4" />
                      Yes
                    </span>
                    <span className="text-slate-500 text-sm">
                      · {landlord.commission_term_text?.trim().length
                        ? landlord.commission_term_text
                        : `£${Number(landlord.commission_amount_gbp ?? 0).toFixed(2)}`}
                    </span>
                  </div>
                ) : (
                  <span className="flex items-center gap-1 text-slate-400">
                    <X className="h-4 w-4" />
                    No
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/landlords/${landlord.id}`}>
                  <Button variant="ghost" size="xs">
                    View
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {landlords.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No landlords found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
