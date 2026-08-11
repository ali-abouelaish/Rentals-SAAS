import { Suspense } from "react";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEmailProviderStatus, getSmtpConfigForEdit } from "@/features/email-providers/data/provider";
import { EmailProviderManager } from "@/features/email-providers/ui/EmailProviderManager";

export default async function EmailSettingsPage() {
  const profile = await requireRole([...ADMIN_ROLES]);
  const [provider, smtpConfig] = await Promise.all([
    getEmailProviderStatus(profile.tenant_id).catch(() => null),
    getSmtpConfigForEdit(profile.tenant_id).catch(() => null),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Email Sending</h1>
        <p className="text-xs text-foreground-secondary">
          Connect your own mailbox to send tenant-facing emails from your agency&apos;s address.
          When nothing is connected, emails send from the default Harbor Ops mailer.
        </p>
      </div>
      {/* useSearchParams (for ?connected/?error toasts) requires a Suspense boundary. */}
      <Suspense>
        <EmailProviderManager provider={provider} smtpConfig={smtpConfig} />
      </Suspense>
    </div>
  );
}
