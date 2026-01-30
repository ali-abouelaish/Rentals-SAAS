import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPublicLead } from "@/features/clients/actions/publicLead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
        <p className="text-sm text-gray-500">Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <form
        action={createPublicLead}
        className="w-full max-w-lg space-y-4 rounded-2xl border border-muted bg-card p-8 shadow-soft"
      >
        <div>
          <h1 className="text-heading text-2xl font-semibold text-navy">
            Client Lead Form
          </h1>
          <p className="text-sm text-gray-500">
            Assigned to {agent.user_profiles?.display_name ?? "Agent"}
          </p>
        </div>
        <input type="hidden" name="agent_id" value={agent.user_id} />
        <input type="hidden" name="tenant_id" value={agent.tenant_id} />
        <Input name="full_name" placeholder="Full name" required />
        <Input name="phone" placeholder="Phone" required />
        <Input name="email" placeholder="Email (optional)" />
        <Input name="nationality" placeholder="Nationality" />
        <Input name="current_address" placeholder="Current address" />
        <Button type="submit" className="w-full">
          Submit
        </Button>
      </form>
    </div>
  );
}
