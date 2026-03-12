import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getTenantBrandingSettings, getTenantDetails } from "@/features/admin/data/admin";
import { TenantBrandingForm } from "@/features/admin/ui/TenantBrandingForm";

export default async function AdminTenantBrandingPage({
  params
}: {
  params: { tenantId: string };
}) {
  const [tenant, branding] = await Promise.all([
    getTenantDetails(params.tenantId),
    getTenantBrandingSettings(params.tenantId)
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
        title={`Branding & Theme · ${tenant.name}`}
        subtitle="Manage tenant brand identity and visual settings."
      />

      <TenantBrandingForm tenantId={tenant.id} tenantName={tenant.name} initial={branding} />
    </div>
  );
}

