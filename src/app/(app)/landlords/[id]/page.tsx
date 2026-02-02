import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { getLandlordById } from "@/features/landlords/data/landlords";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoiceStatusBadge } from "@/features/invoices/ui/InvoiceStatusBadge";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateLandlord } from "@/features/landlords/actions/landlords";

export default async function LandlordDetailPage({
  params
}: {
  params: { id: string };
}) {
  const { landlord, rentalsCount, listings } = await getLandlordById(params.id);
  const supabase = createSupabaseServerClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, due_date")
    .eq("landlord_id", params.id)
    .order("created_at", { ascending: false });

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
          <div>
            <p className="text-xs uppercase text-gray-400">Paying</p>
            <p>
              {landlord.pays_commission
                ? `Yes · ${
                    landlord.commission_term_text?.trim().length
                      ? landlord.commission_term_text
                      : `£${Number(landlord.commission_amount_gbp ?? 0).toFixed(2)}`
                  }`
                : "No"}
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs uppercase text-gray-400">Profile notes</p>
            <p>{landlord.profile_notes ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-navy">Edit landlord</p>
          <form action={updateLandlord} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="landlord_id" value={landlord.id} />
            <Input name="name" defaultValue={landlord.name} placeholder="Name" required />
            <Input name="contact" defaultValue={landlord.contact ?? ""} placeholder="Contact" />
            <Input
              name="billing_address"
              defaultValue={landlord.billing_address ?? ""}
              placeholder="Billing address"
            />
            <Input name="email" defaultValue={landlord.email ?? ""} placeholder="Email" />
            <Input
              name="spareroom_profile_url"
              defaultValue={landlord.spareroom_profile_url ?? ""}
              placeholder="Spareroom profile URL"
            />
            <div>
              <label className="text-xs text-gray-500">Pays commission</label>
              <select
                name="pays_commission"
                defaultValue={landlord.pays_commission ? "yes" : "no"}
                className="h-10 w-full rounded-xl border border-muted bg-card px-3 text-sm shadow-sm"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <Input
              name="commission_amount_gbp"
              type="number"
              step="0.01"
              defaultValue={String(landlord.commission_amount_gbp ?? 0)}
              placeholder="Commission amount (£)"
            />
            <Input
              name="commission_term_text"
              defaultValue={landlord.commission_term_text ?? ""}
              placeholder="Commission term text (e.g. 1 week)"
            />
            <div>
              <label className="text-xs text-gray-500">We do viewing</label>
              <select
                name="we_do_viewing"
                defaultValue={landlord.we_do_viewing ? "yes" : "no"}
                className="h-10 w-full rounded-xl border border-muted bg-card px-3 text-sm shadow-sm"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Textarea
                name="profile_notes"
                defaultValue={landlord.profile_notes ?? ""}
                placeholder="Profile notes"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" variant="secondary">
                Save changes
              </Button>
            </div>
          </form>
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

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium text-navy">Invoices</p>
          <DataTable
            columns={["Invoice", "Status", "Total", "Due", "Actions"]}
            rows={(invoices ?? []).map((invoice) => [
              <span key={`${invoice.id}-number`} className="text-sm text-navy">
                {invoice.invoice_number}
              </span>,
              <InvoiceStatusBadge key={`${invoice.id}-status`} status={invoice.status} />,
              <span key={`${invoice.id}-total`} className="text-sm text-gray-600">
                {formatGBP(Number(invoice.total))}
              </span>,
              <span key={`${invoice.id}-due`} className="text-sm text-gray-600">
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
