import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLeadById } from "@/features/leads/data/leads";
import { LeadDetailsCard } from "@/features/leads/ui/LeadDetailsCard";
import { DeleteLeadButton } from "@/features/leads/ui/DeleteLeadButton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireUserProfile();
  const lead = await getLeadById(params.id);

  let agents: { id: string; display_name: string | null }[] = [];
  if (isAdminRole(profile.role)) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .eq("tenant_id", profile.tenant_id)
      .order("display_name");
    agents = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Leads
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
      </div>

      <LeadDetailsCard lead={lead} agents={agents} isAdmin={isAdminRole(profile.role)} />

      {isAdminRole(profile.role) && (
        <div className="flex">
          <DeleteLeadButton leadId={lead.id} leadName={lead.name} />
        </div>
      )}
    </div>
  );
}
