import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { getComplianceOverview } from "@/features/certificates/data/certificates";
import { getProperties } from "@/features/properties/data/properties";
import { getAllSuppliers } from "@/features/maintenance/data/suppliers";
import { ComplianceDashboard } from "@/features/certificates/ui/ComplianceDashboard";

export default async function CompliancePage() {
  await requireRole([...ADMIN_ROLES]);
  await requireFeature("certificates");

  const [certificates, properties, suppliers] = await Promise.all([
    getComplianceOverview(),
    getProperties(),
    getAllSuppliers().catch(() => []),
  ]);

  return (
    <ComplianceDashboard
      certificates={certificates}
      properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
