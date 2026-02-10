import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PublicLeadForm } from "@/features/clients/ui/PublicLeadForm";

export default async function PublicLeadPage({
  params
}: {
  params: { agentId: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: agent } = await supabase
    .from("agent_profiles")
    .select("user_id, tenant_id, user_profiles(display_name)")
    .eq("user_id", params.agentId)
    .single();

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-foreground-secondary">Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-app px-6">
      <PublicLeadForm
        agentId={agent.user_id}
        tenantId={agent.tenant_id}
        agentName={
          Array.isArray(agent.user_profiles)
            ? agent.user_profiles[0]?.display_name
            : (agent.user_profiles as any)?.display_name ?? "Agent"
        }
      />
    </div>
  );
}
