import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { FilterBar, FilterRow, FilterGroup, FilterPills, FilterPill, FilterActions } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getClients } from "@/features/clients/data/clients";
import { AgentQrCard } from "@/features/clients/ui/AgentQrCard";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { CreateClientDialog } from "@/features/clients/ui/CreateClientDialog";
import { Plus, Users, Phone, ExternalLink } from "lucide-react";

export default async function ClientsPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const profile = await requireUserProfile();
  const activeStatus = searchParams?.status ?? "all";
  const clients = await getClients({
    search: searchParams?.q,
    status: activeStatus
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${process.env.VERCEL_URL ?? "localhost:3000"}`;
  const leadUrl = `${baseUrl}/public/lead/${profile.id}`;

  const statusFilters = ["all", "pending", "on_hold", "solved"];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        subtitle="Manage client leads and profiles"
        action={<CreateClientDialog />}
      />

      {/* QR Code Card */}
      <AgentQrCard url={leadUrl} />

      {/* Filter Bar */}
      <FilterBar>
        <FilterRow>
          <FilterGroup>
            <form className="flex gap-2">
              <Input
                name="q"
                placeholder="Search name or phone..."
                defaultValue={searchParams?.q}
                className="w-64"
              />
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>
          </FilterGroup>
        </FilterRow>
        <div className="mt-3">
          <FilterPills>
            {statusFilters.map((status) => (
              <FilterPill
                key={status}
                href={`/clients?status=${status}`}
                active={activeStatus === status}
              >
                {status === "all" ? "All" : status === "on_hold" ? "On Hold" : status.charAt(0).toUpperCase() + status.slice(1)}
              </FilterPill>
            ))}
          </FilterPills>
        </div>
      </FilterBar>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing <span className="font-medium text-slate-700">{clients.length}</span> clients
        </p>
      </div>

      {/* Clients Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-brand-50 flex items-center justify-center">
                    <span className="text-brand font-medium text-sm">
                      {client.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <Link href={`/clients/${client.id}`} className="font-medium text-brand hover:underline">
                    {client.full_name}
                  </Link>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {client.phone}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={client.status} />
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/clients/${client.id}`}>
                  <Button variant="ghost" size="xs">
                    View
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {clients.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No clients found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
