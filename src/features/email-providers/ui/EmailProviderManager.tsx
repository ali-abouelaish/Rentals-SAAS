"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Mail, Trash2, Plug, Send, AlertTriangle, CheckCircle2, Pencil, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendProviderTestEmail, disconnectEmailProvider } from "../actions/provider";
import { SmtpForm } from "./SmtpForm";
import type { EmailProviderStatusView, SmtpConfigForEdit } from "../data/provider";

const ERROR_LABELS: Record<string, string> = {
  missing_code: "The authorization response was incomplete. Please try again.",
  invalid_state: "Your connect session expired. Please try again.",
  graph_auth_failed: "Could not complete the Microsoft connection. Please try again.",
  gmail_auth_failed: "Could not complete the Gmail connection. Please try again.",
};

const PROVIDER_LABELS: Record<string, string> = {
  graph: "Microsoft 365 (Outlook)",
  gmail: "Google Workspace (Gmail)",
  smtp: "Custom SMTP",
};

const CONNECT_ROUTES: Record<string, string> = {
  graph: "/api/email/graph/connect",
  gmail: "/api/email/gmail/connect",
};

export function EmailProviderManager({
  provider,
  smtpConfig,
}: {
  provider: EmailProviderStatusView | null;
  smtpConfig: SmtpConfigForEdit | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [configuringSmtp, setConfiguringSmtp] = useState(false);

  useEffect(() => {
    if (searchParams.get("connected")) toast.success("Email connection established");
    const err = searchParams.get("error");
    if (err) toast.error(ERROR_LABELS[err] ?? searchParams.get("reason") ?? "Failed to connect");
  }, [searchParams]);

  const onTest = () => {
    startTransition(async () => {
      const res = await sendProviderTestEmail();
      if (res.ok) toast.success("Test email sent — check the connected mailbox");
      else toast.error(res.error);
    });
  };

  const onDisconnect = () => {
    startTransition(async () => {
      try {
        await disconnectEmailProvider();
        toast.success("Disconnected — reverted to the default mailer");
        setConfirming(false);
        router.refresh();
      } catch {
        toast.error("Failed to disconnect");
      }
    });
  };

  // ── Connected state ────────────────────────────────────────────────
  if (provider) {
    const isError = provider.status === "error";
    const label = PROVIDER_LABELS[provider.type] ?? provider.type;

    return (
      <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4 max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
            <Mail className="h-5 w-5 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground">{label}</h2>
            <p className="text-xs text-foreground-secondary">
              Sending tenant-facing emails (including rent reminders) from your mailbox.
            </p>
          </div>
          <span
            title={
              isError
                ? "The connection stopped working. Emails fall back to the default mailer until fixed."
                : "Emails send from your mailbox."
            }
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}
          >
            {isError ? (
              <>
                <AlertTriangle className="h-3 w-3" /> Needs attention
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3" /> Connected
              </>
            )}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-foreground-muted">From address</dt>
            <dd className="text-foreground break-all">{provider.fromAddress ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-foreground-muted">Last verified</dt>
            <dd className="text-foreground">
              {provider.verifiedAt ? new Date(provider.verifiedAt).toLocaleString("en-GB") : "Never"}
            </dd>
          </div>
        </dl>

        {isError && provider.lastError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{provider.lastError}</p>
        ) : null}

        {configuringSmtp && provider.type === "smtp" ? (
          <div className="rounded-lg border border-border bg-surface-inset p-4">
            <SmtpForm initial={smtpConfig} onCancel={() => setConfiguringSmtp(false)} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={isPending}
              onClick={onTest}
              title="Send a test email to the connected mailbox to confirm sending works"
            >
              <Send className="h-3.5 w-3.5" />
              Send test email
            </Button>

            {provider.type === "smtp" ? (
              <Button variant="outline" size="sm" onClick={() => setConfiguringSmtp(true)} title="Edit SMTP settings">
                <Pencil className="h-3.5 w-3.5" />
                Edit settings
              </Button>
            ) : isError && CONNECT_ROUTES[provider.type] ? (
              <Button asChild variant="secondary" size="sm" title="Sign in again to restore sending">
                <a href={CONNECT_ROUTES[provider.type]}>
                  <Plug className="h-3.5 w-3.5" />
                  Reconnect
                </a>
              </Button>
            ) : null}

            {confirming ? (
              <>
                <Button variant="destructive" size="sm" loading={isPending} onClick={onDisconnect}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Confirm disconnect
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirming(true)}
                title="Remove the connection and revert to the default Harbor Ops mailer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Not connected: SMTP form ───────────────────────────────────────
  if (configuringSmtp) {
    return (
      <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4 max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
            <Server className="h-5 w-5 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground">Custom SMTP</h2>
            <p className="text-xs text-foreground-secondary">
              We verify the connection before saving. Credentials are stored encrypted.
            </p>
          </div>
        </div>
        <SmtpForm onCancel={() => setConfiguringSmtp(false)} />
      </div>
    );
  }

  // ── Not connected: chooser ─────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <Mail className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground">Connect your mailbox</h2>
          <p className="text-xs text-foreground-secondary">
            Choose how to send your agency&apos;s emails. Until you connect one, emails send from the
            default Harbor Ops mailer.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Button asChild variant="secondary" title="Sign in with Microsoft 365 and grant permission to send mail">
          <a href="/api/email/graph/connect">
            <Plug className="h-4 w-4" />
            Connect Microsoft 365
          </a>
        </Button>
        <Button asChild variant="secondary" title="Sign in with Google and grant permission to send mail">
          <a href="/api/email/gmail/connect">
            <Plug className="h-4 w-4" />
            Connect Gmail
          </a>
        </Button>
        <Button variant="outline" onClick={() => setConfiguringSmtp(true)} title="Enter your SMTP server credentials">
          <Server className="h-4 w-4" />
          Configure custom SMTP
        </Button>
      </div>
    </div>
  );
}
