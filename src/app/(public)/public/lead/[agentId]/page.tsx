import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PublicLeadForm } from "@/features/clients/ui/PublicLeadForm";

export default async function PublicLeadPage({
  params
}: {
  params: { agentId: string };
}) {
  // Use admin client so public lead links work without authentication and still respect tenant scoping.
  // Query user_profiles (not agent_profiles) so the QR link works for both agents and admins.
  const supabase = createSupabaseAdminClient();
  const { data: user } = await supabase
    .from("user_profiles")
    .select("id, tenant_id, display_name")
    .eq("id", params.agentId)
    .single();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-foreground-secondary">Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-app px-6">
      <PublicLeadForm
        agentId={user.id}
        tenantId={user.tenant_id}
        agentName={user.display_name ?? "Agent"}
      />
    </div>
  );
}
