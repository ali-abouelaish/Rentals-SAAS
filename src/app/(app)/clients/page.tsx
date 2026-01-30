import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getClients } from "@/features/clients/data/clients";
import { AgentQrCard } from "@/features/clients/ui/AgentQrCard";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { ClientForm } from "@/features/clients/ui/ClientForm";

export default async function ClientsPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const profile = await requireUserProfile();
  const clients = await getClients({
    search: searchParams?.q,
    status: searchParams?.status ?? "all"
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${process.env.VERCEL_URL ?? "localhost:3000"}`;
  const leadUrl = `${baseUrl}/public/lead/${profile.id}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" subtitle="Manage client leads and profiles" />

      <AgentQrCard url={leadUrl} />

      <Card>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-navy">Create a client</p>
            <ClientForm />
          </div>
          <form className="flex gap-2">
            <Input
              name="q"
              placeholder="Search name or phone"
              defaultValue={searchParams?.q}
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
          <div className="flex gap-2 text-sm">
            {["all", "pending", "on_hold", "solved"].map((status) => (
              <Link
                key={status}
                href={`/clients?status=${status}`}
                className="rounded-full border border-muted px-3 py-1 hover:bg-muted"
              >
                {status.replace("_", " ")}
              </Link>
            ))}
          </div>
          <DataTable
            columns={["Name", "Phone", "Status", "Actions"]}
            rows={clients.map((client) => [
              <span key={`${client.id}-name`}>{client.full_name}</span>,
              <span key={`${client.id}-phone`}>{client.phone}</span>,
              <StatusBadge key={`${client.id}-status`} status={client.status} />,
              <div key={`${client.id}-actions`} className="flex gap-2 text-sm">
                <Link href={`/clients/${client.id}`} className="text-navy">
                  View
                </Link>
              </div>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
