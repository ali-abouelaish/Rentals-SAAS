import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plug, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getTenantDetails,
  getTenantFeatureEntitlements,
  getTenantIntegrationSubscriptions,
  getTenantEnvelopePurchases
} from "@/features/admin/data/admin";
import { TenantFeaturesManager } from "@/features/admin/ui/TenantFeaturesManager";
import { TenantIntegrationsPanel } from "@/features/admin/ui/TenantIntegrationsPanel";
import { getIntegration } from "@/lib/integrations/catalog";
import { subscriptionGrantsAccess } from "@/lib/integrations/subscriptions";

export default async function AdminTenantFeaturesPage({
  params
}: {
  params: { tenantId: string };
}) {
  const [tenant, entitlements, subscriptions, envelopePurchases] = await Promise.all([
    getTenantDetails(params.tenantId),
    getTenantFeatureEntitlements(params.tenantId),
    getTenantIntegrationSubscriptions(params.tenantId),
    getTenantEnvelopePurchases(params.tenantId)
  ]);
  if (!tenant) notFound();

  // Which paid feature keys the agency's own subscriptions currently grant, so
  // the toggles below can tell "not subscribed" apart from "switched off".
  const subscribedFeatures = subscriptions
    .filter((row) => subscriptionGrantsAccess(row))
    .flatMap((row) => getIntegration(row.integration_key)?.featureKeys ?? []);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/admin/tenants/${params.tenantId}`}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Tenant
        </Link>
      </Button>

      <PageHeader
        title={`Features · ${tenant.name}`}
        subtitle="Enable/disable features for this tenant and set per-feature end dates."
      />

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-1">
            <Plug className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-foreground">Integration Subscriptions</p>
          </div>
          <p className="text-xs text-foreground-secondary mb-4">
            What this agency activated for itself, and what to add to their next
            monthly invoice. No payment is taken at activation. Read-only here —{" "}
            <Link
              href={`/admin/tenants/${params.tenantId}/billing`}
              className="underline hover:text-foreground"
            >
              set what they pay on their billing page
            </Link>
            .
          </p>
          <TenantIntegrationsPanel
            subscriptions={subscriptions}
            envelopePurchases={envelopePurchases}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-foreground">Tenant Feature Controls</p>
          </div>
          <TenantFeaturesManager
            tenantId={tenant.id}
            entitlements={entitlements}
            subscribedFeatures={subscribedFeatures}
          />
        </CardContent>
      </Card>
    </div>
  );
}

