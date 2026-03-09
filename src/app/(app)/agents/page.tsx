import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterBar, FilterRow, FilterGroup, FilterActions } from "@/components/ui/filter-bar";
import { getAgents } from "@/features/agents/data/agents";
import { getEarningsLeaderboardAll } from "@/features/earnings/data/queries";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { Users, Percent } from "lucide-react";
import { AgentTableRow } from "@/features/agents/ui/AgentTableRow";

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    payment_method: "all" as const
  };
}

export default async function AgentsPage({
  searchParams
}: {
  searchParams?: { q?: string; role?: string; sort?: string };
}) {
  await requireRole([...ADMIN_ROLES]);
  const search = searchParams?.q ?? "";
  const role = searchParams?.role ?? "all";
  const sort = searchParams?.sort ?? "earnings";

  const [agents, leaderboard] = await Promise.all([
    getAgents({ search, role }),
    getEarningsLeaderboardAll(getDefaultRange())
  ]);

  const leaderboardByAgentId = new Map(
    leaderboard.map((r) => [r.agent_id, r])
  );

  type Row = {
    user_id: string;
    display_name: string;
    role: string;
    commission_percent: number | null;
    avatar_url: string | null;
    rank: number;
    rentals: number;
    earnings: number;
    last_activity: string | null;
  };

  const rows: Row[] = agents.map((agent) => {
    const lb = leaderboardByAgentId.get(agent.user_id);
    return {
      user_id: agent.user_id,
      display_name: agent.user_profiles?.display_name ?? "Agent",
      role: agent.user_profiles?.role ?? "agent",
      commission_percent: agent.commission_percent ?? null,
      avatar_url: agent.avatar_url ?? null,
      rank: lb?.rank ?? 0,
      rentals: lb?.transactions_count ?? 0,
      earnings: lb?.agent_earnings ?? 0,
      last_activity: lb?.last_activity ?? null
    };
  });

  const sorted =
    sort === "rentals"
      ? [...rows].sort((a, b) => b.rentals - a.rentals)
      : [...rows].sort((a, b) => b.earnings - a.earnings);

  const roleOptions = [
    { value: "all", label: "All Roles" },
    { value: "admin", label: "Admin" },
    { value: "agent", label: "Agent" },
    { value: "marketing_only", label: "Marketing Only" },
    { value: "agent_and_marketing", label: "Agent + Marketing" }
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Agents" subtitle="Agent profiles & earnings" />

      <FilterBar>
        <form method="get" className="flex flex-wrap items-end gap-3">
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
            <FilterGroup label="Sort by">
              <select
                name="sort"
                defaultValue={sort}
                className="flex h-10 w-full rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground-secondary"
              >
                <option value="earnings">Earnings</option>
                <option value="rentals">Rentals</option>
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
          Showing <span className="font-medium text-foreground">{sorted.length}</span> agents
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Rank</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right tabular-nums">Rentals</TableHead>
              <TableHead className="text-right tabular-nums">Earnings</TableHead>
              <TableHead className="text-right tabular-nums">Commission</TableHead>
              <TableHead className="text-right">Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <AgentTableRow key={row.user_id} row={row} />
            ))}
          </TableBody>
        </Table>
      </Card>

      {sorted.length === 0 && (
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
