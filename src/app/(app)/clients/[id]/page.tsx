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

  const profileSections = [
    // Header
    `CLIENT PROFILE: ${client.full_name}`,
    "----------------------------------------",
    "",
    // Contact section
    "Contact",
    "-------",
    `- Full name: ${client.full_name}`,
    `- Phone: ${client.phone}`,
    client.contact_number ? `- Alt phone: ${client.contact_number}` : null,
    client.email ? `- Email: ${client.email}` : null,
    "",
    // Personal details
    "Personal details",
    "----------------",
    client.dob ? `- Date of birth: ${client.dob}` : null,
    client.nationality ? `- Nationality: ${client.nationality}` : null,
    client.current_address ? `- Current address: ${client.current_address}` : null,
    client.occupation ? `- Occupation: ${client.occupation}` : null,
    "",
    // Company / university
    (client.company_or_university_name || client.company_address) ? "Company / University" : null,
    (client.company_or_university_name || client.company_address) ? "--------------------" : null,
    client.company_or_university_name
      ? `- Name: ${client.company_or_university_name}`
      : null,
    client.company_address ? `- Address: ${client.company_address}` : null,
    client.agency_name || client.share_code ? "" : null,
    // Other
    client.agency_name || client.share_code ? "Other" : null,
    client.agency_name || client.share_code ? "-----" : null,
    client.agency_name ? `- Agency: ${client.agency_name}` : null,
    client.share_code ? `- Share code: ${client.share_code}` : null
  ].filter(Boolean) as string[];

  const profileText = profileSections.join("\n");

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
            columns={["Code", "Status", "Date", "Actions"]}
            rows={(rentals ?? []).map((rental) => [
              <Link key={`${rental.id}-code`} href={`/rentals/${rental.id}`} className="text-brand">
                {rental.code}
              </Link>,
              <StatusBadge key={`${rental.id}-status`} status={rental.status} />,
              <span key={`${rental.id}-date`} className="text-sm text-foreground-secondary">
                {formatDate(rental.created_at)}
              </span>,
              <Link
                key={`${rental.id}-edit`}
                href={`/rentals/${rental.id}`}
                className="text-xs text-brand hover:underline"
              >
                Edit rental
              </Link>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
