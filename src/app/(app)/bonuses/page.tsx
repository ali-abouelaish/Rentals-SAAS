import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { getBonuses } from "@/features/bonuses/data/bonuses";
import { BonusForm } from "@/features/bonuses/ui/BonusForm";
import { BonusesTableWithInvoice } from "@/features/bonuses/ui/BonusesTableWithInvoice";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { Input } from "@/components/ui/input";

export default async function BonusesPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string; landlord?: string };
}) {
  const profile = await requireUserProfile();
  const isAdmin = profile.role.toLowerCase() === "admin";
  const supabase = createSupabaseServerClient();
  const search = searchParams?.q ?? "";
  const status = searchParams?.status ?? "all";
  const landlord = searchParams?.landlord ?? "all";
  const bonuses = await getBonuses({ search, status, landlordId: landlord });
  const invoiceEligible = bonuses.filter((bonus) =>
    ["approved", "pending"].includes(bonus.status)
  );
  const { data: landlords } = await supabase
    .from("landlords")
    .select("id, name")
    .order("name", { ascending: true });
  const { data: agents } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .eq("tenant_id", profile.tenant_id)
    .order("display_name", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader title="Bonuses" subtitle="Landlord bonus submissions" />
      <Card>
        <CardContent>
          <form className="flex flex-wrap items-end gap-2" method="get">
            <div>
              <label className="text-xs text-gray-500">Search</label>
              <Input
                name="q"
                placeholder="Code, client, property, landlord"
                defaultValue={search}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select
                name="status"
                defaultValue={status}
                className="h-10 w-full rounded-xl border border-muted bg-card px-3 text-sm shadow-sm"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="declined">Declined</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Landlord</label>
              <select
                name="landlord"
                defaultValue={landlord}
                className="h-10 w-full rounded-xl border border-muted bg-card px-3 text-sm shadow-sm"
              >
                <option value="all">All</option>
                {(landlords ?? []).map((landlordRow) => (
                  <option key={landlordRow.id} value={landlordRow.id}>
                    {landlordRow.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2">
        <Link href="/invoices/from-bonuses" className={buttonVariants({ variant: "outline" })}>
          Create invoice from bonuses
        </Link>
      </div>
      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-navy">Submit bonus</p>
          <BonusForm
            landlords={(landlords ?? []).map((landlord) => ({
              id: landlord.id,
              name: landlord.name
            }))}
            agents={(agents ?? []).map((agent) => ({
              id: agent.id,
              name: agent.display_name ?? "Agent"
            }))}
            isAdmin={isAdmin}
            currentAgentId={profile.id}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-navy">Create invoice from bonuses</p>
          {invoiceEligible.length === 0 ? (
            <p className="text-sm text-gray-500">No bonuses available for invoicing.</p>
          ) : (
            <BonusesTableWithInvoice bonuses={invoiceEligible} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
