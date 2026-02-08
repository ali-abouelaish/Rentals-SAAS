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
import { FilterBar, FilterRow, FilterGroup, FilterPills, FilterPill, FilterActions } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getRentalCodes } from "@/features/rentals/data/rentals";
import { formatDate, formatCurrency } from "@/lib/utils/formatters";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { updateRentalStatus } from "@/features/rentals/actions/rentals";
import { Plus, Home, DollarSign } from "lucide-react";

export default async function RentalsPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const profile = await requireUserProfile();
  const activeStatus = searchParams?.status ?? "all";
  const rentals = await getRentalCodes({
    search: searchParams?.q,
    status: activeStatus
  });

  const isAdmin = profile.role.toLowerCase() === "admin";
  const methodEmoji: Record<string, string> = {
    cash: "💵",
    transfer: "⚡",
    card: "💳"
  };

  const statusFilters = ["all", "pending", "approved", "paid", "refunded"];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rentals"
        subtitle="Rental codes and approvals"
        action={
          <Button asChild>
            <Link href="/clients">
              <Plus className="h-4 w-4 mr-1" />
              Create Rental
            </Link>
          </Button>
        }
      />

      {/* Filter Bar */}
      <FilterBar>
        <FilterRow>
          <FilterGroup>
            <form className="flex gap-2">
              <Input
                name="q"
                placeholder="Search by code or client..."
                defaultValue={searchParams?.q}
                className="w-64"
              />
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>
          </FilterGroup>
        </FilterRow>
        <div className="mt-3">
          <FilterPills>
            {statusFilters.map((status) => (
              <FilterPill
                key={status}
                href={`/rentals?status=${status}`}
                active={activeStatus === status}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </FilterPill>
            ))}
          </FilterPills>
        </div>
      </FilterBar>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing <span className="font-medium text-slate-700">{rentals.length}</span> rentals
        </p>
      </div>

      {/* Rentals Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Fee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rentals.map((rental) => (
            <TableRow key={rental.id}>
              <TableCell>
                <Link href={`/rentals/${rental.id}`} className="font-medium text-brand hover:underline">
                  {rental.code}
                </Link>
              </TableCell>
              <TableCell className="text-slate-600">
                {Array.isArray(rental.clients)
                  ? rental.clients[0]?.full_name
                  : (rental.clients as { full_name?: string })?.full_name ?? rental.client_snapshot?.full_name}
              </TableCell>
              <TableCell>
                <span className="font-medium">{formatCurrency(rental.consultation_fee_amount)}</span>
                <span className="ml-1 text-slate-400">{methodEmoji[rental.payment_method] ?? ""}</span>
              </TableCell>
              <TableCell>
                <StatusBadge status={rental.status} />
              </TableCell>
              <TableCell className="text-slate-500">
                {formatDate(rental.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/rentals/${rental.id}`}>
                    <Button variant="ghost" size="xs">View</Button>
                  </Link>
                  {isAdmin && rental.status === "approved" && (
                    <form
                      action={async (formData) => {
                        "use server";
                        await updateRentalStatus(formData);
                      }}
                    >
                      <input type="hidden" name="rental_id" value={rental.id} />
                      <input type="hidden" name="status" value="paid" />
                      <Button type="submit" variant="success" size="xs">
                        <DollarSign className="h-3 w-3 mr-1" />
                        Paid
                      </Button>
                    </form>
                  )}
                  {isAdmin && rental.status === "paid" && (
                    <form
                      action={async (formData) => {
                        "use server";
                        await updateRentalStatus(formData);
                      }}
                    >
                      <input type="hidden" name="rental_id" value={rental.id} />
                      <input type="hidden" name="status" value="refunded" />
                      <Button type="submit" variant="outline" size="xs">Refund</Button>
                    </form>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {rentals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Home className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No rentals found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
