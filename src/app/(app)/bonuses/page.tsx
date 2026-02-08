import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterRow, FilterGroup, FilterActions } from "@/components/ui/filter-bar";
import { getBonuses } from "@/features/bonuses/data/bonuses";
import { BonusForm } from "@/features/bonuses/ui/BonusForm";
import { BonusesTableWithInvoice } from "@/features/bonuses/ui/BonusesTableWithInvoice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { Plus, FileText, Gift } from "lucide-react";

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

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
    { value: "declined", label: "Declined" }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bonuses"
        subtitle="Landlord bonus submissions"
        action={
          <Link href="/invoices/from-bonuses">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" />
              Create Invoice
            </Button>
          </Link>
        }
      />

      {/* Filter Bar */}
      <FilterBar>
        <form method="get">
          <FilterRow>
            <FilterGroup label="Search">
              <Input
                name="q"
                placeholder="Code, client, property..."
                defaultValue={search}
                className="w-56"
              />
            </FilterGroup>
            <FilterGroup label="Status">
              <select
                name="status"
                defaultValue={status}
                className="flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm border-slate-200 text-slate-700"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup label="Landlord">
              <select
                name="landlord"
                defaultValue={landlord}
                className="flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm border-slate-200 text-slate-700"
              >
                <option value="all">All Landlords</option>
                {(landlords ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
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

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Submit Bonus Form */}
        <Card accent="left" accentColor="gold">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-amber-100">
                <Plus className="h-4 w-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-brand">Submit Bonus</h3>
            </div>
            <BonusForm
              landlords={(landlords ?? []).map((l) => ({
                id: l.id,
                name: l.name
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

        {/* Bonuses for Invoice */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-brand-50">
                  <Gift className="h-4 w-4 text-brand" />
                </div>
                <h3 className="font-semibold text-brand">Eligible for Invoicing</h3>
              </div>
              <span className="text-xs text-slate-500">
                {invoiceEligible.length} bonus{invoiceEligible.length !== 1 ? "es" : ""}
              </span>
            </div>
            {invoiceEligible.length === 0 ? (
              <div className="text-center py-8">
                <Gift className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No bonuses available for invoicing</p>
              </div>
            ) : (
              <BonusesTableWithInvoice bonuses={invoiceEligible} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing <span className="font-medium text-slate-700">{bonuses.length}</span> total bonuses
        </p>
      </div>
    </div>
  );
}
