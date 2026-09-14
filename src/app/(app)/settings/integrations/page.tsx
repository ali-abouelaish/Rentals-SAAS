import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getTenantSubscriptions, type IntegrationSubscription } from "@/lib/integrations/subscriptions";
import { getIntegration } from "@/lib/integrations/catalog";
import { IntegrationsManager } from "@/features/integrations/ui/IntegrationsManager";
import { getMyPlatformInvoices } from "@/features/integrations/data/platformInvoices";
import { MyInvoicesCard } from "@/features/integrations/ui/MyInvoicesCard";

export const metadata = { title: "Integrations" };

// Per-tenant and cookie-scoped: this must never be prerendered into a static
// page shared across agencies. Matches dashboard/assistant/shares.
export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage() {
  const profile = await requireRole([...ADMIN_ROLES]);

  // The table is applied by hand, so there is a window where this page is
  // deployed and the table is not. An empty list renders every integration as
  // "not subscribed", which is honest and still usable, rather than a 500 on a
  // settings page.
  const [rows, invoices] = await Promise.all([
    getTenantSubscriptions(profile.tenant_id).catch(() => [] as IntegrationSubscription[]),
    // Scoped by RLS, not by this call — see getMyPlatformInvoices. Renders
    // nothing at all until an invoice has actually been issued to this agency.
    getMyPlatformInvoices().catch(() => [])
  ]);

  const subscriptions = Object.fromEntries(
    rows
      .filter((row) => getIntegration(row.integration_key))
      .map((row) => [row.integration_key, row])
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Integrations</h1>
        <p className="text-xs text-foreground-secondary">
          Connect Harbor Ops to the services your agency already uses. Turn one on
          and it works straight away — nothing is charged today, and anything paid
          goes on your next monthly invoice.
        </p>
      </div>

      <IntegrationsManager subscriptions={subscriptions} />

      <MyInvoicesCard invoices={invoices} />
    </div>
  );
}
