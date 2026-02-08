import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils/formatters";
import { getClientById } from "@/features/clients/data/clients";
import { CopyProfileButton } from "@/features/clients/ui/CopyProfileButton";
import { ClientForm } from "@/features/clients/ui/ClientForm";
import { RentalCodeForm } from "@/features/rentals/ui/RentalCodeForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ClientDetailPage({
  params
}: {
  params: { id: string };
}) {
  const client = await getClientById(params.id);
  const supabase = createSupabaseServerClient();
  const { data: rentals } = await supabase
    .from("rental_codes")
    .select("id, code, status, created_at")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false });

  const { data: agents } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .eq("tenant_id", client.tenant_id)
    .order("display_name", { ascending: true });

  const profileText = [
    `Client: ${client.full_name}`,
    `Phone: ${client.phone}`,
    `Email: ${client.email}`,
    `Date of birth: ${client.dob}`,
    `Nationality: ${client.nationality}`,
    `Address: ${client.current_address}`,
    `Company/University: ${client.company_or_university_name}`,
    `Company/University address: ${client.company_address}`,
    `Occupation: ${client.occupation}`
  ]
    .join("\n");

  return (
    <div className="space-y-6">
      <PageHeader title={client.full_name} subtitle="Client profile overview" />

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-gray-500">Status</p>
            <StatusBadge status={client.status} />
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Phone</p>
            <p className="text-sm text-navy">{client.phone}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Created</p>
            <p className="text-sm text-brand">{formatDate(client.created_at)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <CopyProfileButton text={profileText} />
      </div>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-brand">Edit client</p>
          <ClientForm clientId={client.id} initialValues={client} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium text-brand">Create rental code</p>
          <RentalCodeForm
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
              <span key={`${rental.id}-date`} className="text-sm text-gray-500">
                {formatDate(rental.created_at)}
              </span>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
