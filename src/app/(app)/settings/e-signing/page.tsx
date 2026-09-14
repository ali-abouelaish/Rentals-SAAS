import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import {
  getESigningActivity,
  getESigningIdentity,
  getESigningPlatformStatus,
} from "@/features/integrations/data/esigning";
import { ESigningSettings } from "@/features/integrations/ui/ESigningSettings";
import { getEnvelopeBalance } from "@/lib/envelopes/balance";

export const metadata = { title: "E-signing" };

// Per-tenant and cookie-scoped: this must never be prerendered into a static
// page shared across agencies. Matches dashboard/assistant/shares.
export const dynamic = "force-dynamic";

export default async function ESigningSettingsPage() {
  const profile = await requireRole([...ADMIN_ROLES]);

  // Not `requireFeature`, which 404s. An admin who lands here without a
  // subscription has a reasonable next step, so send them to it rather than
  // pretending the page doesn't exist.
  if (!(await hasFeature("e_signing"))) {
    redirect("/settings/integrations");
  }

  const [{ identity, source }, activity, balance] = await Promise.all([
    getESigningIdentity(profile.tenant_id),
    getESigningActivity(profile.tenant_id),
    getEnvelopeBalance(profile.tenant_id),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">E-signing</h1>
        <p className="text-xs text-foreground-secondary">
          How tenancy agreements and works orders are sent for signature, and what
          your recipients see when they arrive.
        </p>
      </div>

      <ESigningSettings
        platform={getESigningPlatformStatus()}
        identity={identity}
        source={source}
        activity={activity}
        balance={balance}
      />
    </div>
  );
}
