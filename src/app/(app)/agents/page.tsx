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
  TableRow,
} from "@/components/ui/table";
import { FilterBar, FilterRow, FilterGroup, FilterActions } from "@/components/ui/filter-bar";
import { getAgents } from "@/features/agents/data/agents";
import { requireRole } from "@/lib/auth/requireRole";
import { Users, ExternalLink, Percent } from "lucide-react";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams?: { q?: string; role?: string };
}) {
  await requireRole(["admin"]);
  const search = searchParams?.q ?? "";
  const role = searchParams?.role ?? "all";
  const agents = await getAgents({ search, role });

  const roleOptions = [
    { value: "all", label: "All Roles" },
    { value: "admin", label: "Admin" },
    { value: "agent", label: "Agent" },
    { value: "marketing_only", label: "Marketing Only" },
    { value: "agent_and_marketing", label: "Agent + Marketing" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Agents" subtitle="Agent profiles & commissions" />

      <FilterBar>
        <form method="get">
          <FilterRow>
            <FilterGroup label="Search">
              <Input
                name="q"
                placeholder="Agent name..."
                defaultValue={search}
                className="w-64"
              />
            </FilterGroup>
            <FilterGroup label="Role">
              <select
                name="role"
                defaultValue={role}
                className="flex h-10 w-full rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground-secondary"
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-secondary">
          Showing <span className="font-medium text-foreground">{agents.length}</span> agents
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Commission</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.user_id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-brand-subtle flex items-center justify-center">
                    <span className="text-brand font-medium text-sm">
                      {agent.user_profiles?.display_name?.charAt(0)?.toUpperCase() ?? "A"}
                    </span>
                  </div>
                  <span className="font-medium text-foreground">
                    {agent.user_profiles?.display_name ?? agent.user_id}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="px-2 py-1 rounded-md bg-surface-inset text-foreground-secondary text-xs font-medium capitalize">
                  {agent.user_profiles?.role ?? "agent"}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-success font-medium">
                  <Percent className="h-3.5 w-3.5" />
                  {agent.commission_percent}%
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/agents/${agent.user_id}`}>
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

      {agents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-foreground-muted mx-auto mb-3" />
            <p className="text-foreground-secondary">No agents found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
