import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { getAgents } from "@/features/agents/data/agents";
import { requireRole } from "@/lib/auth/requireRole";

export default async function AgentsPage() {
  await requireRole(["admin"]);
  const agents = await getAgents();

  return (
    <div className="space-y-6">
      <PageHeader title="Agents" subtitle="Agent profiles & commissions" />
      <Card>
        <CardContent>
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
