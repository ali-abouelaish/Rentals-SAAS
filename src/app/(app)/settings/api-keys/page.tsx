import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { listPublicApiKeys } from "@/features/api-keys/data/queries";
import { ApiKeysPanel } from "@/features/api-keys/ui/ApiKeysPanel";

export default async function ApiKeysPage() {
  await requireRole([...ADMIN_ROLES]);
  const enabled = await getEntitlements();
  if (!enabled.has("public_api_access")) {
    redirect("/dashboard");
  }
  const keys = await listPublicApiKeys();
  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        subtitle="Issue keys so external platforms can read your scraped listings."
      />
      <ApiKeysPanel keys={keys} />
    </div>
  );
}
