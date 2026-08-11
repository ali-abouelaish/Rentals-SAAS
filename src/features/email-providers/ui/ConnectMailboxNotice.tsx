import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";
import { getEmailProviderStatus } from "../data/provider";

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  graph: "Microsoft 365",
  smtp: "SMTP",
};

/**
 * Server component: nudges agencies that haven't connected their own mailbox
 * (or whose connection is broken) on the pages that send email on their
 * behalf. Renders nothing when a provider is connected and healthy.
 */
export async function ConnectMailboxNotice({ tenantId }: { tenantId: string }) {
  const provider = await getEmailProviderStatus(tenantId).catch(() => null);

  // Connected and healthy — nothing to say.
  if (provider?.status === "active") return null;

  if (provider && (provider.status === "error" || provider.status === "unverified")) {
    const label = PROVIDER_LABELS[provider.type] ?? provider.type;
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/50 p-3 sm:p-4">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-foreground-secondary">
          <p className="text-sm font-medium text-foreground">
            Your {label} connection {provider.status === "error" ? "has a problem" : "isn't verified yet"}
          </p>
          <p className="mt-0.5">
            {provider.status === "error"
              ? `Emails are falling back to the shared Harbor Ops mailer${provider.lastError ? ` (${provider.lastError})` : ""}. `
              : "Emails send from the shared Harbor Ops mailer until it's verified. "}
            <Link href="/settings/email" className="underline font-medium hover:text-foreground">
              Fix it in Settings → Email Sending
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // No custom provider at all.
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface-card p-3 sm:p-4">
      <Mail className="h-4 w-4 text-foreground-secondary mt-0.5 shrink-0" />
      <div className="text-xs text-foreground-secondary">
        <p className="text-sm font-medium text-foreground">
          Emails currently send from the shared Harbor Ops mailer
        </p>
        <p className="mt-0.5">
          Reminders, rent emails, portal invites, and form links will come from{" "}
          <span className="font-mono">noreply@harborops</span> with replies going to your
          contact address. To send from your own agency mailbox instead, go to{" "}
          <Link href="/settings/email" className="underline font-medium hover:text-foreground">
            Settings → Email Sending
          </Link>{" "}
          and connect Gmail, Microsoft 365, or SMTP — it takes about a minute: choose your
          provider, approve access in the sign-in window, and send yourself a test email.
          If your mailbox ever has a problem, sending automatically falls back to the
          shared mailer so nothing is lost.
        </p>
      </div>
    </div>
  );
}
