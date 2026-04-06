import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTenantDetails, getAgencyModuleConfig } from "@/features/admin/data/admin";
import { TenantModulesManager } from "@/features/admin/ui/TenantModulesManager";

export default async function AdminTenantModulesPage({
  params
}: {
  params: { tenantId: string };
}) {
  const [tenant, moduleConfig] = await Promise.all([
    getTenantDetails(params.tenantId),
    getAgencyModuleConfig(params.tenantId)
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
        title={`Modules · ${tenant.name}`}
        subtitle="Assign which products this agency can access and publish the configuration."
      />

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-5">
            <Layers className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-foreground">Module Assignment</p>
          </div>
          <TenantModulesManager tenantId={tenant.id} config={moduleConfig} />
        </CardContent>
      </Card>
    </div>
  );
}
