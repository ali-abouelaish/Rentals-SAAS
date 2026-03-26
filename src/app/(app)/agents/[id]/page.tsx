import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAgentById } from "@/features/agents/data/agents";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { canAccessRoute } from "@/lib/auth/roles";
import { AgentCommissionForm } from "@/features/agents/ui/AgentCommissionForm";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { AgentDisableToggle } from "@/features/agents/ui/AgentDisableToggle";
import { BusinessCardModal } from "@/features/me/ui/BusinessCardModal";

export default async function AgentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireUserProfile();
  const isAdmin = canAccessRoute(profile.role, ADMIN_ROLES);
  const canView = isAdmin || profile.id === params.id;

  if (!canView) {
    return (
      <div className="rounded-bento bg-surface-card shadow-bento p-8 text-center">
        <p className="text-foreground-muted">You don&apos;t have access to this profile.</p>
      </div>
    );
  }

  const headersList = headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const cardUrl = `${protocol}://${host}/public/card/${params.id}`;

  const [agent, entitlements] = await Promise.all([
    getAgentById(params.id),
    getEntitlements(),
  ]);
  const hasBusinessCard = entitlements.has("digital_business_card");
  const displayName = agent.user_profiles?.display_name ?? "Agent";

  const roleLabel = (() => {
    const role = (agent.user_profiles?.role ?? "agent").toLowerCase();
    if (role === "agent_and_marketing") return "Agent";
    if (role === "marketing_only") return "Marketing only";
    if (role === "super_admin") return "Admin";
    return role.charAt(0).toUpperCase() + role.slice(1);
  })();

  return (
    <div className="space-y-6">
      {/* ── Back ─────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/agents" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Agents
          </Link>
        </Button>
      </div>

      <PageHeader title={displayName} subtitle="Agent profile" />

      {/* ── Avatar + quick info ──────────────────── */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16">
              <AvatarCircle name={displayName} url={agent.avatar_url ?? undefined} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
              <p className="text-sm text-foreground-muted">{roleLabel}</p>
              <p className="text-xs text-foreground-muted mt-0.5">
                {agent.is_disabled ? (
                  <span className="text-red-500">Disabled</span>
                ) : (
                  <span className="text-emerald-600">Active</span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {hasBusinessCard && (
              <BusinessCardModal agentId={params.id} cardUrl={cardUrl} />
            )}
            <Button variant="outline" asChild>
              <Link href={`/earnings/${params.id}`} className="gap-2">
                <TrendingUp className="h-4 w-4" />
                View Earnings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Admin settings ─────────────────────── */}
      {isAdmin && (
        <>
          <Card>
            <CardContent className="grid gap-4 md:grid-cols-3 text-sm pt-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground-muted mb-1">Role</p>
                <p className="text-foreground">{roleLabel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground-muted mb-1">Commission</p>
                <p className="text-foreground">{agent.commission_percent}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground-muted mb-1">Marketing fee</p>
                <p className="text-foreground">£{agent.marketing_fee}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground-muted mb-1">Status</p>
                <p className="text-foreground mb-2">
                  {agent.is_disabled ? "Disabled" : "Active"}
                </p>
                <AgentDisableToggle userId={agent.user_id} isDisabled={Boolean(agent.is_disabled)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <p className="text-sm font-medium text-brand">Update commission &amp; role</p>
              <AgentCommissionForm
                userId={agent.user_id}
                commission_percent={agent.commission_percent}
                marketing_fee={agent.marketing_fee}
                role={(agent.user_profiles as { role?: string } | null)?.role ?? "agent"}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
