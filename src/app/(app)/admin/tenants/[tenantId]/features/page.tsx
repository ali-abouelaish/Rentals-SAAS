import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTenantDetails, getTenantFeatureEntitlements } from "@/features/admin/data/admin";
import { TenantFeaturesManager } from "@/features/admin/ui/TenantFeaturesManager";

export default async function AdminTenantFeaturesPage({
  params
}: {
  params: { tenantId: string };
}) {
  const [tenant, entitlements] = await Promise.all([
    getTenantDetails(params.tenantId),
    getTenantFeatureEntitlements(params.tenantId)
  ]);
  if (!tenant) notFound();

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
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-foreground">Tenant Feature Controls</p>
          </div>
          <TenantFeaturesManager tenantId={tenant.id} entitlements={entitlements} />
        </CardContent>
      </Card>
    </div>
  );
}

