import { FileSignature } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { getESigningAgencies } from "@/features/integrations/data/adminESigning";
import { getESigningPlatformStatus } from "@/features/integrations/data/esigning";
import { ESigningAgenciesManager } from "@/features/integrations/ui/ESigningAgenciesManager";

export default async function AdminESigningPage() {
  const agencies = await getESigningAgencies();
  const platform = getESigningPlatformStatus();

  return (
    <div className="space-y-5">
      <PageHeader
        title="E-signing"
        subtitle="Each agency's sending identity on BoldSign. A brand controls what a document looks like; a sender identity controls who it comes from."
      />

      {(!platform.configured || !platform.webhookConfigured) && (
        <Card>
          <CardContent className="pt-5 space-y-1">
            {!platform.configured && (
              <p className="text-xs text-amber-800">
                <strong>BOLDSIGN_API_KEY is not set on this environment.</strong> Nothing
                on this page can reach BoldSign until it is.
              </p>
            )}
            {platform.configured && !platform.webhookConfigured && (
              <p className="text-xs text-amber-800">
                <strong>BOLDSIGN_WEBHOOK_SECRET is not set.</strong> Documents send and
                can be signed, but no completion ever comes back — contracts will not
                reach <code>signed</code> and no signed copy or audit trail is stored.
              </p>
            )}
            <p className="text-[11px] text-foreground-muted">
              Mode: {platform.environment} · {platform.host}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-1">
            <FileSignature className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-foreground">Agency Sending Identities</p>
          </div>
          <p className="text-xs text-foreground-secondary mb-4">
            Creating a brand emails nobody and is safe to run for any agency with a logo.
            Requesting a sender identity is not offered here — it emails the agency&apos;s
            mailbox a verification link, so it has to come from the agency&apos;s own
            settings page.
          </p>
          <ESigningAgenciesManager agencies={agencies} />
        </CardContent>
      </Card>
    </div>
  );
}
