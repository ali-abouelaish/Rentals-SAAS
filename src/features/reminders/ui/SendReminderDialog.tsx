"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  getRentReminderPreview,
  sendRentReminderNow,
  type ReminderKind,
} from "@/features/reminders/actions/send-now";

type Props = {
  open: boolean;
  pmTenantId: string;
  tenantName?: string;
  onOpenChange: (open: boolean) => void;
};

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

export function SendReminderDialog({ open, pmTenantId, tenantName, onOpenChange }: Props) {
  const { toast } = useToast();
  const [pending, startSend] = useTransition();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [kind, setKind] = useState<ReminderKind>("rent_due");
  const [body, setBody] = useState("");
  const [defaultBodies, setDefaultBodies] = useState<Record<ReminderKind, string> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError(null);
    setDirty(false);
    getRentReminderPreview(pmTenantId).then((result) => {
      if (cancelled) return;
      setLoadingPreview(false);
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setKind(result.suggestedKind);
      setDefaultBodies(result.defaultBody);
      setBody(result.defaultBody[result.suggestedKind]);
      setSentTo(result.sentTo);
    });
    return () => {
      cancelled = true;
    };
  }, [open, pmTenantId]);

  function handleKindChange(next: ReminderKind) {
    setKind(next);
    if (!dirty && defaultBodies) {
      setBody(defaultBodies[next]);
    }
  }

  function handleBodyChange(value: string) {
    setBody(value);
    setDirty(true);
  }

  function handleResetBody() {
    if (!defaultBodies) return;
    setBody(defaultBodies[kind]);
    setDirty(false);
  }

  function handleSend() {
    startSend(async () => {
      const result = await sendRentReminderNow(pmTenantId, {
        kind,
        customBody: dirty ? body : undefined,
      });
      if (!result.ok) {
        toast({ variant: "error", title: "Reminder not sent", description: result.error });
        return;
      }
      toast({
        title: result.kind === "rent_overdue" ? "Overdue notice sent" : "Rent reminder sent",
        description: `Sent to ${result.sentTo}${result.kind === "rent_overdue" ? ` · ${result.daysOverdue} day(s) overdue` : ""}`,
      });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Send rent reminder{tenantName ? ` — ${tenantName}` : ""}
          </DialogTitle>
        </DialogHeader>

        {loadingPreview ? (
          <div className="py-10 text-center text-sm text-foreground-muted">Loading…</div>
        ) : previewError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {previewError}
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Email type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleKindChange("rent_due")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    kind === "rent_due"
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-border bg-surface-card text-foreground-secondary hover:border-brand/40"
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  Rent due reminder
                </button>
                <button
                  type="button"
                  onClick={() => handleKindChange("rent_overdue")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    kind === "rent_overdue"
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-border bg-surface-card text-foreground-secondary hover:border-red-300"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Overdue notice
                </button>
              </div>
            </div>

            {sentTo && (
              <div className="text-xs text-foreground-muted">
                Sending to <span className="text-foreground">{sentTo}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Message body</label>
                {dirty && (
                  <button
                    type="button"
                    onClick={handleResetBody}
                    className="text-xs text-brand hover:underline"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <textarea
                value={body}
                onChange={(e) => handleBodyChange(e.target.value)}
                rows={14}
                className={`${inputCls} h-auto py-2 font-mono text-[12px] leading-relaxed`}
              />
              <p className="text-[11px] text-foreground-muted">
                Edits replace the templated content for this send. The agency footer and unsubscribe link
                are not appended to custom bodies.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSend}
                loading={pending}
              >
                Send reminder
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
