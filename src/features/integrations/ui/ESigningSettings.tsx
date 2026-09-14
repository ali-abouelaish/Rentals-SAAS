import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileSignature,
  Info,
} from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import type {
  ESigningActivity,
  ESigningAgencyIdentity,
  ESigningBrandSource,
  ESigningPlatformStatus,
} from "../data/esigning";
import { SendingIdentityCard } from "./SendingIdentityCard";
import { EnvelopeBalanceCard } from "./EnvelopeBalanceCard";
import type { EnvelopeBalance } from "@/lib/envelopes/packs";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-foreground-muted mt-0.5">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "ok" && "bg-emerald-100 text-emerald-800",
        tone === "warn" && "bg-amber-100 text-amber-800",
        tone === "muted" && "bg-neutral-200 text-neutral-700"
      )}
    >
      {children}
    </span>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-foreground-secondary mt-0.5 mb-2">{description}</p>
      {children}
    </section>
  );
}

export function ESigningSettings({
  platform,
  identity,
  source,
  activity,
  balance,
}: {
  platform: ESigningPlatformStatus;
  identity: ESigningAgencyIdentity | null;
  source: ESigningBrandSource | null;
  activity: ESigningActivity;
  balance: EnvelopeBalance;
}) {
  // Documents send fine without a webhook — they just never come back. Worth
  // saying loudly, because everything looks healthy right up until nothing
  // completes.
  const showWebhookWarning = platform.configured && !platform.webhookConfigured;

  return (
    <div className="space-y-4">
      {showWebhookWarning && (
        <div className="flex gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" aria-hidden />
          <div>
            <p className="text-xs font-semibold text-amber-900">
              Signature completions aren&apos;t being received
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Documents will send and people can sign them, but without a webhook
              connection nothing comes back — contracts won&apos;t move to Signed
              on their own, and signed copies won&apos;t be filed. Contact us and
              we&apos;ll finish connecting it.
            </p>
          </div>
        </div>
      )}

      <EnvelopeBalanceCard balance={balance} />

      <Card
        title="Connection"
        description="How your documents reach the signing provider. Managed by us — there's nothing here for you to change."
      >
        <Row
          label="Signing provider"
          hint="BoldSign, on the EU data region. Documents and audit trails never leave the EU."
        >
          <Pill tone={platform.configured ? "ok" : "warn"}>
            {platform.configured ? (
              <>
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Connected
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Not connected
              </>
            )}
          </Pill>
        </Row>

        <Row
          label="Mode"
          hint={
            platform.environment === "live"
              ? "Signatures are legally binding."
              : "Test mode — documents are marked as samples and are not legally binding."
          }
        >
          <Pill tone={platform.environment === "live" ? "ok" : "warn"}>
            {platform.environment === "live" ? "Live" : "Sandbox"}
          </Pill>
        </Row>

        <Row
          label="Completion updates"
          hint="Tells Harbor Ops when someone has signed, so records update themselves."
        >
          <Pill tone={platform.webhookConfigured ? "ok" : "warn"}>
            {platform.webhookConfigured ? "Receiving" : "Not connected"}
          </Pill>
        </Row>
      </Card>

      <SendingIdentityCard identity={identity} source={source} />

      <Card
        title="Document defaults"
        description="How signature requests behave once sent."
      >
        <Row
          label="Signing order"
          hint="On a tenancy the tenant signs first, then the landlord countersigns. Fixed for now."
        >
          <Pill tone="muted">Tenant, then landlord</Pill>
        </Row>
        <Row
          label="Expiry and reminders"
          hint="How long a request stays open, and how often unsigned documents are chased."
        >
          <Tooltip content="Not configurable yet — requests currently use the provider's defaults. Tell us if the timing is wrong for your agency.">
            <span className="inline-block">
              <Pill tone="muted">
                <Clock className="h-3 w-3" aria-hidden />
                Coming soon
              </Pill>
            </span>
          </Tooltip>
        </Row>
      </Card>

      <Card
        title="Activity"
        description="What your agency has sent for signature."
      >
        {activity.total === 0 ? (
          <p className="text-xs text-foreground-secondary">
            Nothing sent yet. The <em>Send for signature</em> button appears on a{" "}
            <Link href="/contracts" className="text-brand hover:underline">
              contract
            </Link>{" "}
            once it&apos;s been generated from a template, and on a works order
            once a contractor with an email address is assigned.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Sent", value: activity.total },
                { label: "Awaiting signature", value: activity.awaitingSignature },
                { label: "Signed", value: activity.completed },
                { label: "Failed", value: activity.failed },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-surface-inset p-2.5">
                  <p className="text-lg font-semibold text-foreground leading-none">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-foreground-muted mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
            {activity.hasSandboxDocuments && (
              <p className="text-[11px] text-foreground-muted mt-2">
                Some of these were sent in test mode and are not legally binding.
              </p>
            )}
          </>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
        <FileSignature className="h-3.5 w-3.5" aria-hidden />
        Manage your subscription on the{" "}
        <Link href="/settings/integrations" className="text-brand hover:underline">
          Integrations page
          <ArrowUpRight className="inline h-3 w-3 ml-0.5" aria-hidden />
        </Link>
      </p>
    </div>
  );
}
