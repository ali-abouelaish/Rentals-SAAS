import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { getAgentById } from "@/features/agents/data/agents";
import { requireRole } from "@/lib/auth/requireRole";
import { AgentCommissionForm } from "@/features/agents/ui/AgentCommissionForm";

export default async function AgentDetailPage({
  params
}: {
  params: { id: string };
}) {
  await requireRole(["admin"]);
  const agent = await getAgentById(params.id);

  return (
    <div className="space-y-6">
      <PageHeader title={agent.user_profiles?.display_name ?? "Agent"} subtitle="Agent profile" />
      <Card>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm text-gray-600">
          <div>
            <p className="text-xs uppercase text-gray-400">Role</p>
            <p>{agent.user_profiles?.role ?? "agent"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">Commission</p>
            <p>{agent.commission_percent}%</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">Marketing fee</p>
            <p>£{agent.marketing_fee}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-brand">Admin-only updates</p>
          <AgentCommissionForm
            userId={agent.user_id}
            commission_percent={agent.commission_percent}
            marketing_fee={agent.marketing_fee}
          />
        </CardContent>
      </Card>
    </div>
  );
}
