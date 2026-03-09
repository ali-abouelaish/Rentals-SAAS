import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils/formatters";
import { getClientById } from "@/features/clients/data/clients";
import { CopyProfileButton } from "@/features/clients/ui/CopyProfileButton";
import { ClientDetailsCard } from "@/features/clients/ui/ClientDetailsCard";
import { CreateRentalCodeCard } from "@/features/rentals/ui/CreateRentalCodeCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ClientDetailPage({
  params
}: {
  params: { id: string };
}) {
  const client = await getClientById(params.id);
  const supabase = createSupabaseServerClient();
  const [{ data: rentals }, { data: agents }] = await Promise.all([
    supabase
      .from("rental_codes")
      .select("id, code, status, created_at")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_profiles")
      .select("id, display_name")
      .eq("tenant_id", client.tenant_id)
      .order("display_name", { ascending: true })
  ]);

  const profileText = [
    `Client: ${client.full_name}`,
    `Phone: ${client.phone}`,
    client.contact_number ? `Contact number: ${client.contact_number}` : null,
    `Email: ${client.email}`,
    `Date of birth: ${client.dob}`,
    `Nationality: ${client.nationality}`,
    `Address: ${client.current_address}`,
    `Company/University: ${client.company_or_university_name}`,
    `Company/University address: ${client.company_address}`,
    `Occupation: ${client.occupation}`,
    client.agency_name ? `Agency: ${client.agency_name}` : null,
    client.share_code ? `Share code: ${client.share_code}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-6">
      <PageHeader title={client.full_name} subtitle="Client profile overview" />

      <ClientDetailsCard client={client} />

      <div className="flex items-center gap-3">
        <CopyProfileButton text={profileText} />
      </div>

      <Card>
        <CardContent>
          <CreateRentalCodeCard
            clientId={client.id}
            agents={(agents ?? []).map((agent) => ({
              id: agent.id,
              name: agent.display_name ?? "Agent"
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium text-navy">Rental codes</p>
          <DataTable
            columns={["Code", "Status", "Date"]}
            rows={(rentals ?? []).map((rental) => [
              <Link key={`${rental.id}-code`} href={`/rentals/${rental.id}`} className="text-brand">
                {rental.code}
              </Link>,
              <StatusBadge key={`${rental.id}-status`} status={rental.status} />,
              <span key={`${rental.id}-date`} className="text-sm text-foreground-secondary">
                {formatDate(rental.created_at)}
              </span>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
