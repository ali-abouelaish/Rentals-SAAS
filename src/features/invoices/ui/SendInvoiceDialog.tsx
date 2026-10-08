"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Eye, Loader2, Mail, Pencil, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import {
  buildInvoiceEmailDraft,
  previewInvoiceEmail,
  saveLandlordEmailForInvoice,
  sendInvoiceEmail,
  type InvoiceEmailDraft,
} from "../actions/invoices";
import {
  invoiceEmailSchema,
  invoiceRecipientSchema,
  type InvoiceEmailValues,
  type InvoiceRecipientValues,
} from "../domain/email";

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

/**
 * Email an invoice to its landlord. Two steps:
 *  1. If the landlord has no email on file, ask for one (saved to the landlord)
 *     or let the user cancel.
 *  2. Review the subject + message (pre-filled from the agency's template),
 *     preview the branded email, and send with the PDF attached.
 */
export function SendInvoiceDialog({
  invoiceId,
  invoiceNumber,
  open,
  onClose,
}: {
  invoiceId: string;
  invoiceNumber: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<InvoiceEmailDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSending, startSending] = useTransition();
  const [isSavingEmail, startSavingEmail] = useTransition();
  const [tab, setTab] = useState<"edit" | "preview">("preview");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const emailForm = useForm<InvoiceEmailValues>({
    resolver: zodResolver(invoiceEmailSchema),
    defaultValues: { subject: "", body: "" },
  });
  const recipientForm = useForm<InvoiceRecipientValues>({
    resolver: zodResolver(invoiceRecipientSchema),
    defaultValues: { email: "" },
  });
  const { reset: resetEmail } = emailForm;

  // Rebuild every time it opens: the template, the landlord's email or the
  // invoice itself may have changed since last time.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setDraft(null);
    setPreviewHtml(null);
    setTab("preview");
    recipientForm.reset({ email: "" });

    buildInvoiceEmailDraft(invoiceId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLoadError(result.error);
          return;
        }
        setDraft(result.draft);
        setPreviewHtml(result.draft.previewHtml);
        resetEmail({ subject: result.draft.subject, body: result.draft.body });
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
    // recipientForm.reset is stable; listing the form object would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId, resetEmail]);

  const showPreview = () => {
    setTab("preview");
    setPreviewLoading(true);
    previewInvoiceEmail(invoiceId, emailForm.getValues())
      .then((result) => {
        if (result.ok) setPreviewHtml(result.html);
        else toast.error(result.error);
      })
      .catch(() => toast.error("Could not render the preview."))
      .finally(() => setPreviewLoading(false));
  };

  const onSaveEmail = (values: InvoiceRecipientValues) => {
    startSavingEmail(async () => {
      const result = await saveLandlordEmailForInvoice(invoiceId, values);
      if (result.ok) {
        // The subject and message fields keep whatever is already in them;
        // only the recipient changed. Re-render the preview from those fields.
        setDraft(result.draft);
        showPreview();
        toast.success("Email saved to the landlord");
      } else {
        recipientForm.setError("email", { message: result.error });
      }
    });
  };

  const onSend = (values: InvoiceEmailValues) => {
    startSending(async () => {
      const result = await sendInvoiceEmail(invoiceId, values);
      if (result.ok) {
        toast.success(`Invoice ${invoiceNumber} sent to ${draft?.to ?? "the landlord"}`);
        onClose();
        router.refresh();
        return;
      }
      if (result.code === "missing_email" && draft) {
        // The landlord's email was removed while the dialog was open.
        setDraft({ ...draft, to: null });
      }
      toast.error(result.error);
    });
  };

  // A send that has started can't be called back — closing the dialog would
  // only hide it while the server carries on. Hold the dialog open until the
  // result is in, so "Cancel" never pretends to stop an email.
  const busy = isSending || isSavingEmail;
  const close = () => {
    if (!busy) onClose();
  };

  const needsEmail = draft !== null && draft.to === null;
  const title = draft?.isResend ? `Resend invoice ${invoiceNumber}` : `Send invoice ${invoiceNumber}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{needsEmail ? "Add the landlord's email" : title}</DialogTitle>
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
        ) : needsEmail ? (
          <form onSubmit={recipientForm.handleSubmit(onSaveEmail)} className="space-y-4">
            <Notice>
              <strong>{draft.landlordName}</strong> has no email address on file, so this invoice
              has nowhere to go. Add one to continue, or cancel and send it later.
            </Notice>

            <div className="flex flex-col gap-1">
              <label htmlFor="invoice-recipient" className="text-sm font-medium text-foreground">
                Landlord email
              </label>
              <p className={hintCls}>
                For example name@example.com. Saved to the landlord&apos;s record and used for
                future invoices too.
              </p>
              <input
                id="invoice-recipient"
                type="email"
                autoComplete="email"
                className={cn(
                  inputCls,
                  recipientForm.formState.errors.email ? "border-red-400" : "border-border"
                )}
                {...recipientForm.register("email")}
              />
              {recipientForm.formState.errors.email && (
                <p className={errCls}>{recipientForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Tooltip content="Updates the landlord's record, then takes you to the email so you can review it before it goes.">
                <Button type="submit" variant="secondary" size="sm" loading={isSavingEmail}>
                  Save email &amp; continue
                </Button>
              </Tooltip>
            </div>
          </form>
        ) : draft ? (
          <form onSubmit={emailForm.handleSubmit(onSend)} className="space-y-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                To
              </span>
              <span className="text-sm text-foreground">
                {draft.landlordName} &lt;{draft.to}&gt;
              </span>
              <p className={cn(hintCls, "flex items-center gap-1 flex-wrap")}>
                <Mail className="h-3 w-3" />
                Sends from {draft.sendingFrom} with the invoice PDF attached.
                {draft.canEditTemplate ? (
                  <Link href="/settings/email" className="underline hover:text-foreground">
                    Change mailbox
                  </Link>
                ) : null}
              </p>
            </div>

            {draft.isResend ? (
              <Notice>
                This invoice has already been sent. Sending again emails the landlord a fresh copy
                with the current PDF.
              </Notice>
            ) : null}

            {draft.unknownKeys.length > 0 ? (
              <Notice>
                Nothing to fill {draft.unknownKeys.map((k) => `{{${k}}}`).join(", ")} — it will be
                sent as written. Fix it in the template or edit it out below.
              </Notice>
            ) : null}

            <div className="flex flex-col gap-1">
              <label htmlFor="invoice-subject" className="text-sm font-medium text-foreground">
                Subject
              </label>
              <p className={hintCls}>Max 200 characters. Shown in the landlord&apos;s inbox.</p>
              <input
                id="invoice-subject"
                type="text"
                className={cn(
                  inputCls,
                  emailForm.formState.errors.subject ? "border-red-400" : "border-border"
                )}
                {...emailForm.register("subject")}
              />
              {emailForm.formState.errors.subject && (
                <p className={errCls}>{emailForm.formState.errors.subject.message}</p>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-inset p-0.5 w-fit">
              <Tooltip content="See the finished email as the landlord will, with your logo and colours applied.">
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
              <Tooltip content="Change the wording for this one send. The layout and branding are applied for you.">
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
              <label htmlFor="invoice-body" className="text-sm font-medium text-foreground">
                Message
              </label>
              <p className={hintCls}>
                Max 10,000 characters. Edits apply to this one send only. Use{" "}
                <code className="text-[10px]">## Heading</code> for a section,{" "}
                <code className="text-[10px]">- item</code> for a bullet and{" "}
                <code className="text-[10px]">**bold**</code> — the layout and branding are applied
                automatically.
              </p>
              <textarea
                id="invoice-body"
                rows={12}
                className={cn(
                  inputCls,
                  "font-mono text-[12.5px] leading-relaxed resize-y",
                  emailForm.formState.errors.body ? "border-red-400" : "border-border"
                )}
                {...emailForm.register("body")}
              />
              {emailForm.formState.errors.body && (
                <p className={errCls}>{emailForm.formState.errors.body.message}</p>
              )}
            </div>

            {tab === "preview" ? (
              <div className="relative rounded-lg border border-border overflow-hidden bg-[#fafaf8]">
                {previewLoading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-card/70 text-xs text-foreground-secondary gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rendering…
                  </div>
                ) : null}
                {previewHtml ? (
                  <iframe
                    title="Invoice email preview"
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
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
              {draft.canEditTemplate ? (
                <Tooltip content="Change the wording every landlord receives. Edits there become the starting point for future invoices.">
                  <Link
                    href="/settings/billing-profiles#invoice-email"
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-foreground-link underline-offset-4 hover:underline"
                  >
                    Edit the default invoice email
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Tooltip>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                {isSending ? (
                  <span className="text-[11px] text-foreground-muted">
                    Sending — this can take a few seconds…
                  </span>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={close} disabled={busy}>
                  Cancel
                </Button>
                <Tooltip content="Emails the landlord now with the current invoice PDF attached, and marks the invoice as sent.">
                  <Button type="submit" variant="secondary" size="sm" loading={isSending}>
                    <Send className="h-3.5 w-3.5 mr-1" />
                    {draft.isResend ? "Resend invoice" : "Send invoice"}
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
