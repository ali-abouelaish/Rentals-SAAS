import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { getLandlordById } from "@/features/landlords/data/landlords";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoiceStatusBadge } from "@/features/invoices/ui/InvoiceStatusBadge";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { EditLandlordForm } from "@/features/landlords/ui/EditLandlordForm";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { deleteLandlord } from "@/features/landlords/actions/landlords";
import { ConfirmDeleteForm } from "@/components/shared/ConfirmDeleteForm";
import { Button } from "@/components/ui/button";

export default async function LandlordDetailPage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const [landlordResult, { data: invoices }, profile] = await Promise.all([
    getLandlordById(params.id),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, due_date")
      .eq("landlord_id", params.id)
      .order("created_at", { ascending: false }),
    requireUserProfile()
  ]);
  const { landlord, rentalsCount, listings, scrapedListings } = landlordResult;

  return (
    <div className="space-y-6">
      <PageHeader
        title={landlord.name}
        subtitle="Landlord detail"
        action={profile.role === "admin" ? (
          <ConfirmDeleteForm action={deleteLandlord} message="Delete this landlord? This cannot be undone.">
            <input type="hidden" name="landlord_id" value={landlord.id} />
            <Button type="submit" variant="outline" size="sm">Delete landlord</Button>
          </ConfirmDeleteForm>
        ) : undefined}
      />
      <Card>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm text-foreground-secondary">
          <div>
            <p className="text-xs uppercase text-foreground-muted">Name</p>
            <p className="font-medium text-foreground">{landlord.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">Contact</p>
            <p>{landlord.contact ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">Email</p>
            <p>{landlord.email ?? "—"}</p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs uppercase text-foreground-muted">Billing address</p>
            <p className="whitespace-pre-wrap">{landlord.billing_address ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">SpareRoom profile</p>
            <p>
              {landlord.spareroom_profile_url ? (
                <a href={landlord.spareroom_profile_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline break-all">
                  {landlord.spareroom_profile_url}
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">Paying commission</p>
            <p>
              {landlord.pays_commission
                ? `Yes${landlord.commission_term_text?.trim() ? ` · ${landlord.commission_term_text}` : landlord.commission_amount_gbp != null ? ` · ${formatGBP(Number(landlord.commission_amount_gbp))}` : ""}`
                : "No"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">We do viewing</p>
            <p>{landlord.we_do_viewing ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">Times rented from</p>
            <p>{rentalsCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-foreground-muted">Created</p>
            <p>{landlord.created_at ? formatDate(landlord.created_at) : "—"}</p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs uppercase text-foreground-muted">Profile notes</p>
            <p className="whitespace-pre-wrap">{landlord.profile_notes ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <EditLandlordForm landlord={landlord} />
        </CardContent>
      </Card>

      {(scrapedListings.length > 0 || listings.length > 0) && (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-navy">
              Listings {scrapedListings.length > 0 ? `(${scrapedListings.length} from scraper)` : ""}
            </p>
            {scrapedListings.length > 0 ? (
              <DataTable
                columns={["Title", "Location", "Price", "Status", "Rooms", "Available", "Link"]}
                rows={scrapedListings.map((row) => [
                  <span key={`${row.id}-title`} className="max-w-[200px] truncate block" title={row.title ?? undefined}>
                    {row.title ?? "—"}
                  </span>,
                  <span key={`${row.id}-loc`} className="text-foreground-secondary">{row.location ?? "—"}</span>,
                  <span key={`${row.id}-price`}>{row.price != null ? formatGBP(Number(row.price)) : "—"}</span>,
                  <span key={`${row.id}-status`}>{row.status ?? "—"}</span>,
                  <span key={`${row.id}-rooms`}>{row.room_count ?? row.total_rooms ?? "—"}</span>,
                  <span key={`${row.id}-avail`}>{row.available_date ? formatDate(row.available_date) : "—"}</span>,
                  row.url ? (
                    <a key={`${row.id}-link`} href={row.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                      View
                    </a>
                  ) : (
                    <span key={`${row.id}-link`}>—</span>
                  ),
                ])}
              />
            ) : (
              <DataTable
                columns={["Title", "Price", "Postcode", "Active"]}
                rows={listings.map((listing) => [
                  <span key={`${listing.id}-title`}>{listing.title}</span>,
                  <span key={`${listing.id}-price`}>£{listing.price}</span>,
                  <span key={`${listing.id}-postcode`}>{listing.postcode}</span>,
                  <span key={`${listing.id}-active`}>{listing.is_active ? "Yes" : "No"}</span>
                ])}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium text-brand">Invoices</p>
          <DataTable
            columns={["Invoice", "Status", "Total", "Due", "Actions"]}
            rows={(invoices ?? []).map((invoice) => [
              <span key={`${invoice.id}-number`} className="text-sm text-navy">
                {invoice.invoice_number}
              </span>,
              <InvoiceStatusBadge key={`${invoice.id}-status`} status={invoice.status} />,
              <span key={`${invoice.id}-total`} className="text-sm text-foreground-secondary">
                {formatGBP(Number(invoice.total))}
              </span>,
              <span key={`${invoice.id}-due`} className="text-sm text-foreground-secondary">
                {formatDate(invoice.due_date)}
              </span>,
              <Link key={`${invoice.id}-action`} href={`/invoices/${invoice.id}`} className="text-navy">
                View
              </Link>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
