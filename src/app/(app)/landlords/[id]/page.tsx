import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDeleteForm } from "@/components/shared/ConfirmDeleteForm";
import { getLandlordById } from "@/features/landlords/data/landlords";
import { deleteLandlord } from "@/features/landlords/actions/landlords";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoiceStatusBadge } from "@/features/invoices/ui/InvoiceStatusBadge";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { formatAge, isStale, STALE_AFTER_DAYS } from "@/lib/utils/freshness";
import { EditLandlordForm } from "@/features/landlords/ui/EditLandlordForm";
import { RunScraperButton } from "@/features/landlords/ui/RunScraperButton";
import { LandlordSheetCard } from "@/features/listing-feeds/ui/LandlordSheetCard";
import { ListingDetailsDrawer } from "@/features/listing-feeds/ui/ListingDetailsDrawer";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { TrackEntityVisit } from "@/features/search/ui/TrackEntityVisit";
import { Trash2, ArrowLeft } from "lucide-react";

export default async function LandlordDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { back?: string };
}) {
  const backHref = searchParams?.back ?? "/landlords";
  const profile = await requireUserProfile();
  const isAdmin = profile.role.toLowerCase() === "admin";
  const supabase = createSupabaseServerClient();
  const [landlordResult, { data: invoices }] = await Promise.all([
    getLandlordById(params.id),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, due_date")
      .eq("landlord_id", params.id)
      .order("created_at", { ascending: false })
  ]);
  if (!landlordResult) notFound();
  const { landlord, rentalsCount, listings, scrapedListings, sheetRuns, sheetListingCount } =
    landlordResult;

  return (
    <div className="space-y-6">
      <TrackEntityVisit
        tenantId={profile.tenant_id}
        kind="landlord"
        id={landlord.id}
        title={landlord.name}
        subtitle={landlord.email ?? landlord.contact ?? null}
        href={`/landlords/${landlord.id}`}
      />
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Landlords
      </Link>
      <div className="flex items-start justify-between">
        <PageHeader title={landlord.name} subtitle="Landlord detail" />
        {isAdmin && (
          <div className="flex items-center gap-2">
            {landlord.spareroom_profile_url && (
              <RunScraperButton landlordId={landlord.id} />
            )}
            <ConfirmDeleteForm
              action={deleteLandlord}
              message={`Delete landlord "${landlord.name}"? This cannot be undone.`}
            >
              <input type="hidden" name="landlord_id" value={params.id} />
              <Button type="submit" variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Landlord
              </Button>
            </ConfirmDeleteForm>
          </div>
        )}
      </div>
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
          {/* Only meaningful for landlords with a source to scrape. A run that
              cannot reach the profile deliberately leaves this untouched, so a
              date drifting into the past is the signal that the listings below
              are no longer being refreshed. */}
          {landlord.spareroom_profile_url && (
            <div>
              <p className="text-xs uppercase text-foreground-muted">Last scraped</p>
              <p
                className={isStale(landlord.last_scraped_at) ? "font-medium text-destructive" : undefined}
                title={
                  landlord.last_scraped_at
                    ? `Last successful read: ${formatDate(landlord.last_scraped_at)}`
                    : "This landlord's SpareRoom profile has never been read successfully."
                }
              >
                {formatAge(landlord.last_scraped_at)}
                {landlord.last_scraped_at ? ` · ${formatDate(landlord.last_scraped_at)}` : ""}
              </p>
            </div>
          )}
          <div className="md:col-span-3">
            <p className="text-xs uppercase text-foreground-muted">Profile notes</p>
            <p className="whitespace-pre-wrap">{landlord.profile_notes ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Renders only when a spreadsheet link is set; the link itself is edited
          in the landlord form below, next to the SpareRoom profile URL. */}
      <LandlordSheetCard
        landlord={landlord}
        runs={sheetRuns}
        listingCount={sheetListingCount}
      />

      <Card>
        <CardContent>
          <EditLandlordForm landlord={landlord} />
        </CardContent>
      </Card>

      {(scrapedListings.length > 0 || listings.length > 0) && (
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-navy">
                Listings {scrapedListings.length > 0 ? `(${scrapedListings.length} from scraper)` : ""}
              </p>
              {/* Stale rows are served by the public API exactly like fresh ones,
                  so the count has to be visible here or nobody finds out until a
                  partner complains about dead links. */}
              {scrapedListings.filter((row) => isStale(row.last_seen_at)).length > 0 && (
                <p className="text-xs text-destructive">
                  {scrapedListings.filter((row) => isStale(row.last_seen_at)).length} of{" "}
                  {scrapedListings.length} not confirmed in the last {STALE_AFTER_DAYS} days — these
                  may no longer be live.
                </p>
              )}
            </div>
            {scrapedListings.length > 0 ? (
              <DataTable
                columns={["Title", "Location", "Price", "Source", "Scraped", "Rooms", "Available", "Link"]}
                rows={scrapedListings.map((row) => [
                  <span key={`${row.id}-title`} className="max-w-[200px] truncate block" title={row.title ?? undefined}>
                    {row.title ?? "—"}
                  </span>,
                  <span key={`${row.id}-loc`} className="text-foreground-secondary">{row.location ?? "—"}</span>,
                  <span key={`${row.id}-price`}>{row.price != null ? formatGBP(Number(row.price)) : "—"}</span>,
                  // Which pipeline put this row here. The two refresh
                  // independently, so a stale row means different things
                  // depending on the source and they must not read alike.
                  <span key={`${row.id}-source`} className="text-foreground-secondary">
                    {row.source === "spreadsheet" ? "Spreadsheet" : "SpareRoom"}
                  </span>,
                  // Replaces the old Status column, which was useless here:
                  // the scraper hardcodes 'available' on every row, so a listing
                  // dead for months still claimed to be available. Age is the
                  // only honest liveness signal we have.
                  <span
                    key={`${row.id}-seen`}
                    className={isStale(row.last_seen_at) ? "font-medium text-destructive" : undefined}
                    title={
                      row.last_seen_at
                        ? `Last confirmed at source: ${formatDate(row.last_seen_at)}`
                        : `Never confirmed since freshness tracking was added — treat as unverified.`
                    }
                  >
                    {formatAge(row.last_seen_at)}
                  </span>,
                  <span key={`${row.id}-rooms`}>{row.room_count ?? row.total_rooms ?? "—"}</span>,
                  <span key={`${row.id}-avail`}>{row.available_date ? formatDate(row.available_date) : "—"}</span>,
                  // Only link out for absolute http(s) URLs. A relative href
                  // here (e.g. stray text imported from a spreadsheet) would
                  // resolve against /landlords/<id> and navigate to a bogus
                  // landlord route. Listings with no advert — the normal case
                  // for spreadsheet imports — open a drawer instead, so their
                  // data and photos are reachable.
                  /^https?:\/\//i.test(row.url ?? "") ? (
                    <a key={`${row.id}-link`} href={row.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                      View
                    </a>
                  ) : (
                    <ListingDetailsDrawer key={`${row.id}-link`} listing={row} />
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
