"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { createSampleInboxRequest, updateReplyToEmail } from "../actions/branding";
import { useRouter } from "next/navigation";

type TemplateKey = "rent_due" | "rent_overdue" | "communication_request";

const TEMPLATE_OPTIONS: { value: TemplateKey; label: string; hint: string }[] = [
  {
    value: "rent_due",
    label: "Rent due reminder",
    hint: "Tenant-facing rent-due email with sample amount and a 5-day-out due date.",
  },
  {
    value: "rent_overdue",
    label: "Rent overdue",
    hint: "Tenant-facing overdue notice, sample amount, marked 7 days past due.",
  },
  {
    value: "communication_request",
    label: "Inbox notification",
    hint: "Agency-internal alert when a tenant submits a request from their preferences page.",
  },
];

type Props = {
  defaultEmail: string;
  currentReplyTo: string;
};

export function EmailTestCard({ defaultEmail, currentReplyTo }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail);
  const [template, setTemplate] = useState<TemplateKey>("rent_due");
  const [replyTo, setReplyTo] = useState(currentReplyTo);
  const [savedReplyTo, setSavedReplyTo] = useState(currentReplyTo);
  const [sendPending, startSend] = useTransition();
  const [savePending, startSave] = useTransition();
  const [samplePending, startSample] = useTransition();

  const activeHint =
    TEMPLATE_OPTIONS.find((t) => t.value === template)?.hint ?? "";
  const replyDirty = replyTo.trim() !== savedReplyTo.trim();

  function handleSend() {
    startSend(async () => {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email.trim(), template }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sentTo?: string;
        fromAddress?: string;
        templateLabel?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        toast({
          variant: "error",
          title: "Test send failed",
          description: data.error
            ? `${data.error}${data.fromAddress ? ` (from ${data.fromAddress})` : ""}`
            : "Unknown error",
        });
      } else {
        toast({
          title: `${data.templateLabel ?? "Test email"} sent`,
          description: `${data.fromAddress ? `From ${data.fromAddress} - ` : ""}sent to ${data.sentTo ?? email}`,
        });
      }
    });
  }

  function handleCreateSample() {
    startSample(async () => {
      const result = await createSampleInboxRequest();
      if ("error" in result) {
        toast({ variant: "error", title: "Could not create sample", description: result.error });
      } else {
        toast({
          title: "Sample request created",
          description: "Opening it in the Inbox...",
        });
        router.push(`/inbox/${result.requestId}`);
      }
    });
  }

  function handleSaveReplyTo() {
    startSave(async () => {
      const fd = new FormData();
      fd.set("reply_to_email", replyTo.trim());
      const result = await updateReplyToEmail(fd);
      if (result?.error) {
        toast({ variant: "error", title: "Could not save", description: result.error });
      } else {
        setSavedReplyTo(replyTo.trim());
        toast({ title: "Reply-to saved", description: "Tenants can now reply to this address." });
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Email testing</h2>
          <p className="mt-1 text-xs text-foreground-secondary leading-relaxed">
            Render any of the templates with sample data using your agency&rsquo;s branding and send it to the address below. The Reply-to address controls where replies to your reminders go.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface-inset/40 p-4 space-y-2">
          <label htmlFor="reply_to_email" className="block text-xs font-medium text-foreground-muted">
            Reply-to address
          </label>
          <div className="flex gap-2">
            <Input
              id="reply_to_email"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="lettings@youragency.co.uk"
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              loading={savePending}
              disabled={!replyDirty}
              onClick={handleSaveReplyTo}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-foreground-muted leading-relaxed">
            Emails are sent from a noreply address that can&rsquo;t receive replies. When tenants click reply, their mail goes to this address instead. Leave empty to fall back to the noreply alias (replies will bounce).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Template"
            value={template}
            onChange={(value: string) => setTemplate(value as TemplateKey)}
            options={TEMPLATE_OPTIONS.map(({ value, label }) => ({ value, label }))}
          />
          <div>
            <label htmlFor="test_email_to" className="block text-xs font-medium text-foreground-muted mb-1.5">
              Send test to
            </label>
            <Input
              id="test_email_to"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </div>
        <p className="text-xs text-foreground-muted leading-relaxed">{activeHint}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" loading={sendPending} onClick={handleSend}>
            Send test email
          </Button>
          <Button type="button" variant="outline" loading={samplePending} onClick={handleCreateSample}>
            Create sample inbox request
          </Button>
        </div>
        <p className="text-xs text-foreground-muted leading-relaxed">
          The test email is a visual preview only. Use <strong>Create sample inbox request</strong> to insert a real row so the <a href="/inbox" className="underline hover:text-foreground">Inbox dashboard</a> populates end-to-end (uses your most recent tenant).
        </p>
      </CardContent>
    </Card>
  );
}
