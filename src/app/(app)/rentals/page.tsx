import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getRentalCodes } from "@/features/rentals/data/rentals";
import { formatDate } from "@/lib/utils/formatters";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { updateRentalStatus } from "@/features/rentals/actions/rentals";

export default async function RentalsPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const profile = await requireUserProfile();
  const rentals = await getRentalCodes({
    search: searchParams?.q,
    status: searchParams?.status ?? "all"
  });

  const isAdmin = profile.role.toLowerCase() === "admin";
  const methodEmoji: Record<string, string> = {
    cash: "💵",
      transfer: "⚡",
    card: "💳"
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rentals"
        subtitle="Rental codes and approvals"
        action={
          <Button asChild>
            <Link href="/clients">Create rental</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-4">
          <form className="flex gap-2">
            <Input
              name="q"
              placeholder="Search by code or client"
              defaultValue={searchParams?.q}
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
          <div className="flex gap-2 text-sm">
            {["all", "pending", "approved", "paid", "refunded"].map((status) => (
              <Link
                key={status}
                href={`/rentals?status=${status}`}
                className="rounded-full border border-muted px-3 py-1 hover:bg-muted"
              >
                {status.replace("_", " ")}
              </Link>
            ))}
          </div>
          <DataTable
            columns={[
              "Code",
              "Client",
              "Fee",
              "Status",
              "Date",
              "Actions"
            ]}
            rows={rentals.map((rental) => [
              <Link key={`${rental.id}-code`} href={`/rentals/${rental.id}`} className="text-navy">
                {rental.code}
              </Link>,
              <span key={`${rental.id}-client`} className="text-sm text-gray-600">
                {rental.clients?.full_name ?? rental.client_snapshot?.full_name}
              </span>,
              <span key={`${rental.id}-fee`} className="text-sm text-gray-600">
                £{rental.consultation_fee_amount} {methodEmoji[rental.payment_method] ?? ""}
              </span>,
              <StatusBadge key={`${rental.id}-status`} status={rental.status} />,
              <span key={`${rental.id}-date`} className="text-sm text-gray-500">
                {formatDate(rental.created_at)}
              </span>
              ,
              <div key={`${rental.id}-actions`} className="flex items-center gap-2 text-sm">
                <Link href={`/rentals/${rental.id}`} className="text-navy">
                  View
                </Link>
                {isAdmin && rental.status === "pending" ? (
                  <Link href={`/rentals/${rental.id}`} className="text-navy">
                    Approve
                  </Link>
                ) : null}
                {isAdmin && rental.status === "approved" ? (
                  <form action={updateRentalStatus}>
                    <input type="hidden" name="rental_id" value={rental.id} />
                    <input type="hidden" name="status" value="paid" />
                    <Button type="submit" variant="outline" size="sm">
                      Mark paid
                    </Button>
                  </form>
                ) : null}
                {isAdmin && rental.status === "paid" ? (
                  <form action={updateRentalStatus}>
                    <input type="hidden" name="rental_id" value={rental.id} />
                    <input type="hidden" name="status" value="refunded" />
                    <Button type="submit" variant="outline" size="sm">
                      Refund
                    </Button>
                  </form>
                ) : null}
              </div>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
