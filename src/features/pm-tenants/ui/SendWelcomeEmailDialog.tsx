"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Eye, Loader2, Pencil, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import {
  buildWelcomeEmailDraft,
  previewWelcomeEmail,
  sendWelcomeEmail,
  type WelcomeEmailDraft,
} from "../actions/welcome-email";
import {
  welcomeEmailSendSchema,
  type WelcomeEmailSendValues,
} from "../domain/schemas";

const inputCls =
  "w-full rounded-lg border bg-surface-inset px-3 py-2.5 md:py-2 text-base md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const hintCls = "text-[11px] text-foreground-muted mt-1";
const errCls = "text-xs text-red-500 mt-1";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

export function SendWelcomeEmailDialog({
  pmTenantId,
  tenantName,
  open,
  onClose,
}: {
  pmTenantId: string;
  tenantName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<WelcomeEmailDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSending, startSending] = useTransition();
  const [tab, setTab] = useState<"edit" | "preview">("preview");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<WelcomeEmailSendValues>({
    resolver: zodResolver(welcomeEmailSendSchema),
    defaultValues: { subject: "", body: "" },
  });

  // Rebuild the draft each time the dialog opens: the agency may have edited
  // the template, or the tenant's tenancy may have changed, since last time.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setDraft(null);
    setPreviewHtml(null);
    setTab("preview");

    buildWelcomeEmailDraft(pmTenantId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLoadError(result.error);
          return;
        }
        setDraft(result.draft);
        setPreviewHtml(result.draft.previewHtml);
        reset({ subject: result.draft.subject, body: result.draft.body });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to build the email.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, pmTenantId, reset]);

  // Switching to Preview re-renders server-side, so what staff see is built by
  // the same code path that builds the email that actually sends.
  const showPreview = () => {
    setTab("preview");
    setPreviewLoading(true);
    previewWelcomeEmail(pmTenantId, getValues())
      .then((result) => {
        if (result.ok) setPreviewHtml(result.html);
        else toast.error(result.error);
      })
      .catch(() => toast.error("Could not render the preview."))
      .finally(() => setPreviewLoading(false));
  };

  const onSubmit = (values: WelcomeEmailSendValues) => {
    startSending(async () => {
      const result = await sendWelcomeEmail(pmTenantId, values);
      if (result.ok) {
        toast.success(`Welcome email sent to ${tenantName}`);
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send welcome email</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-10 justify-center text-sm text-foreground-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Building the email…
          </div>
        ) : loadError ? (
          <div className="py-6 space-y-3">
            <p className="text-sm text-red-500">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : draft ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                To
              </span>
              <span className="text-sm text-foreground">{draft.to}</span>
              <p className={hintCls}>
                Filled in from {draft.entityLabel}. Your logo, colours and footer are added
                automatically when it sends.
              </p>
            </div>

            {draft.missingTenancy ? (
              <Notice>
                This tenant has no active tenancy yet, so the rent, address and start-date
                placeholders are blank. Link them to a contract first, or edit the text below
                before sending.
              </Notice>
            ) : null}

            {!draft.portalEnabled ? (
              <Notice>
                The tenant portal is not enabled for this workspace, so the sign-in link will
                come out empty. Remove the portal section below before sending.
              </Notice>
            ) : null}

            {draft.unknownKeys.length > 0 ? (
              <Notice>
                Nothing to fill{" "}
                {draft.unknownKeys.map((k) => `{{${k}}}`).join(", ")} — it will be sent as
                written. Fix it in the template or edit it out below.
              </Notice>
            ) : null}

            <div className="flex flex-col gap-1">
              <label htmlFor="welcome-subject" className="text-sm font-medium text-foreground">
                Subject
              </label>
              <p className={hintCls}>Max 200 characters. Shown in the renter&apos;s inbox.</p>
              <input
                id="welcome-subject"
                type="text"
                className={cn(inputCls, errors.subject ? "border-red-400" : "border-border")}
                {...register("subject")}
              />
              {errors.subject && <p className={errCls}>{errors.subject.message}</p>}
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-inset p-0.5 w-fit">
              <Tooltip content="See the finished email exactly as the renter will, with your logo and colours applied.">
                <button
                  type="button"
                  onClick={showPreview}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    tab === "preview"
                      ? "bg-surface-card text-foreground shadow-sm"
                      : "text-foreground-secondary hover:text-foreground"
                  )}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
              </Tooltip>
              <Tooltip content="Change the wording for this one send. The layout and branding are applied for you and can't be edited here.">
                <button
                  type="button"
                  onClick={() => setTab("edit")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    tab === "edit"
                      ? "bg-surface-card text-foreground shadow-sm"
                      : "text-foreground-secondary hover:text-foreground"
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit text
                </button>
              </Tooltip>
            </div>

            {/* The textarea stays mounted while previewing: unmounting it would
                unregister the field and make handleSubmit fail silently. */}
            <div className={cn("flex flex-col gap-1", tab === "preview" && "hidden")}>
              <label htmlFor="welcome-body" className="text-sm font-medium text-foreground">
                Message
              </label>
              <p className={hintCls}>
                Max 10,000 characters. Edits apply to this one send only. Use{" "}
                <code className="text-[10px]">## Heading</code> for a section,{" "}
                <code className="text-[10px]">- item</code> for a bullet,{" "}
                <code className="text-[10px]">**bold**</code>, and{" "}
                <code className="text-[10px]">[Label](link)</code> on its own line for a
                button — the layout and branding are applied automatically.
              </p>
              <textarea
                id="welcome-body"
                rows={16}
                className={cn(
                  inputCls,
                  "font-mono text-[12.5px] leading-relaxed resize-y",
                  errors.body ? "border-red-400" : "border-border"
                )}
                {...register("body")}
              />
              {errors.body && <p className={errCls}>{errors.body.message}</p>}
            </div>

            {tab === "preview" ? (
              <div className="flex flex-col gap-1">
                <div className="relative rounded-lg border border-border overflow-hidden bg-[#fafaf8]">
                  {previewLoading ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-card/70 text-xs text-foreground-secondary gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Rendering…
                    </div>
                  ) : null}
                  {previewHtml ? (
                    <iframe
                      title="Welcome email preview"
                      sandbox=""
                      srcDoc={previewHtml}
                      className="w-full h-[420px] border-0 bg-white"
                    />
                  ) : (
                    <div className="h-[420px] flex items-center justify-center text-xs text-foreground-secondary">
                      No preview available.
                    </div>
                  )}
                </div>
                <p className={hintCls}>
                  The sign-in button is inert here — a live 20-minute link is generated when
                  you send.
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-1">
              {draft.canEditTemplate ? (
                <Tooltip content="Change the wording every tenant receives. Edits there become the new starting point for future sends.">
                  <Link
                    href="/automations/templates"
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-foreground-link underline-offset-4 hover:underline"
                  >
                    Edit the template for all tenants
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Tooltip>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Tooltip content="Sends immediately from your agency's email address — it does not wait for the daily send window.">
                  <Button type="submit" variant="secondary" size="sm" loading={isSending}>
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Send now
                  </Button>
                </Tooltip>
              </div>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
