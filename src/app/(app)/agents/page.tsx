import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { getAgents } from "@/features/agents/data/agents";
import { requireRole } from "@/lib/auth/requireRole";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function AgentsPage({
  searchParams
}: {
  searchParams?: { q?: string; role?: string };
}) {
  await requireRole(["admin"]);
  const search = searchParams?.q ?? "";
  const role = searchParams?.role ?? "all";
  const agents = await getAgents({ search, role });

  return (
    <div className="space-y-6">
      <PageHeader title="Agents" subtitle="Agent profiles & commissions" />
      <Card>
        <CardContent>
          <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
            <div>
              <label className="text-xs text-gray-500">Search</label>
              <Input name="q" placeholder="Agent name" defaultValue={search} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Role</label>
              <select
                name="role"
                defaultValue={role}
                className="h-10 w-full rounded-xl border border-muted bg-card px-3 text-sm shadow-sm"
              >
                <option value="all">All</option>
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
                <option value="marketing_only">Marketing only</option>
                <option value="agent_and_marketing">Agent + Marketing</option>
              </select>
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
          <DataTable
            columns={["Name", "Role", "Commission", "Actions"]}
            rows={agents.map((agent) => [
              <span key={`${agent.user_id}-name`}>{agent.user_profiles?.display_name ?? agent.user_id}</span>,
              <span key={`${agent.user_id}-role`}>{agent.user_profiles?.role ?? "agent"}</span>,
              <span key={`${agent.user_id}-commission`}>{agent.commission_percent}%</span>,
              <Link key={`${agent.user_id}-link`} href={`/agents/${agent.user_id}`} className="text-navy">
                View
              </Link>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
