import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getBonusById } from "@/features/bonuses/data/bonuses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BonusEditForm } from "@/features/bonuses/ui/BonusEditForm";
import { Gift, ArrowLeft } from "lucide-react";

function formatBonusCode(code: string | null, fallbackId: string) {
  if (!code) return fallbackId.slice(0, 8);
  return code.startsWith("LC") ? code : `LC${code}`;
}

export default async function BonusDetailPage({
  params
}: {
  params: { id: string };
}) {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const [bonus, { data: landlords }, { data: agents }] = await Promise.all([
    getBonusById(params.id).catch(() => null),
    supabase.from("landlords").select("id, name").order("name", { ascending: true }),
    supabase
      .from("user_profiles")
      .select("id, display_name")
      .eq("tenant_id", profile.tenant_id)
      .order("display_name", { ascending: true })
  ]);

  if (!bonus) notFound();

  const landlordRelation = bonus.landlords;
  const landlordName = Array.isArray(landlordRelation)
    ? (landlordRelation[0] as { name: string | null } | undefined)?.name ?? "—"
    : landlordRelation && typeof landlordRelation === "object" && "name" in landlordRelation
      ? (landlordRelation as { name: string | null }).name ?? "—"
      : "—";

  const agentRelation = bonus.agent;
  const agentName = Array.isArray(agentRelation)
    ? (agentRelation[0] as { display_name: string | null } | undefined)?.display_name ?? "—"
    : agentRelation && typeof agentRelation === "object" && "display_name" in agentRelation
      ? (agentRelation as { display_name: string | null }).display_name ?? "—"
      : "—";

  const canEdit =
    profile.role?.toLowerCase() === "admin" ||
    (bonus.agent_id === profile.id && bonus.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/bonuses" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Bonuses
          </Link>
        </Button>
      </div>

      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-brand-subtle flex items-center justify-center">
              <Gift className="h-6 w-6 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {formatBonusCode(bonus.code, bonus.id)}
              </h1>
              <p className="text-sm text-foreground-muted">Landlord bonus</p>
            </div>
          </div>
          <StatusBadge status={bonus.status} />
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-foreground-muted font-medium">Date</dt>
            <dd className="text-foreground mt-0.5">{formatDate(bonus.bonus_date)}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted font-medium">Landlord</dt>
            <dd className="text-foreground mt-0.5">{landlordName}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted font-medium">Agent</dt>
            <dd className="text-foreground mt-0.5">{agentName}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted font-medium">Client</dt>
            <dd className="text-foreground mt-0.5">{bonus.client_name}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted font-medium">Property</dt>
            <dd className="text-foreground mt-0.5">{bonus.property_address}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted font-medium">Amount</dt>
            <dd className="text-foreground mt-0.5 font-semibold tabular-nums">
              {formatCurrency(bonus.amount_owed)}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted font-medium">Payout mode</dt>
            <dd className="text-foreground mt-0.5 capitalize">{bonus.payout_mode}</dd>
          </div>
          {bonus.notes && (
            <div className="sm:col-span-2">
              <dt className="text-foreground-muted font-medium">Notes</dt>
              <dd className="text-foreground mt-0.5">{bonus.notes}</dd>
            </div>
          )}
        </dl>

        {canEdit && (
          <div className="mt-8 pt-6 border-t border-border">
            <h2 className="text-base font-semibold text-foreground mb-4">Edit bonus</h2>
            <BonusEditForm
              bonus={bonus}
              landlords={(landlords ?? []).map((l) => ({ id: l.id, name: l.name }))}
              agents={(agents ?? []).map((a) => ({
                id: a.id,
                name: a.display_name ?? "Agent"
              }))}
              isAdmin={profile.role?.toLowerCase() === "admin"}
              currentAgentId={profile.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
