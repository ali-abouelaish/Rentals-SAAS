"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Eye, Loader2, Pencil, RotateCcw, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { extractMergeKeys } from "@/features/automations/lib/render";
import {
  previewInvoiceEmailTemplate,
  resetInvoiceEmailTemplate,
  saveInvoiceEmailTemplate,
} from "../actions/emailTemplate";
import {
  DEFAULT_INVOICE_EMAIL,
  INVOICE_MERGE_FIELDS,
  invoiceEmailSchema,
  type InvoiceEmailValues,
} from "../domain/email";

const inputCls =
  "w-full rounded-lg border bg-surface-inset px-3 py-2.5 md:py-2 text-base md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const hintCls = "text-[11px] text-foreground-muted mt-1";
const errCls = "text-xs text-red-500 mt-1";

const KNOWN_KEYS = new Set(INVOICE_MERGE_FIELDS.map((f) => f.key));

/**
 * The agency-wide invoice email: what the send dialog starts from for every
 * invoice. Staff can still tweak the wording per send.
 */
export function InvoiceEmailTemplateCard({
  initial,
  isDefault,
  canConnectMailbox,
}: {
  initial: InvoiceEmailValues;
  isDefault: boolean;
  /** False when Email Sending is switched off — no mailbox, no link to one. */
  canConnectMailbox: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isResetting, startResetting] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<InvoiceEmailValues>({
    resolver: zodResolver(invoiceEmailSchema),
    defaultValues: initial,
  });

  const subject = watch("subject");
  const body = watch("body");
  const unknownKeys = [
    ...new Set([...extractMergeKeys(subject ?? ""), ...extractMergeKeys(body ?? "")]),
  ].filter((k) => !KNOWN_KEYS.has(k));

  const { ref: bodyRegisterRef, ...bodyField } = register("body");

  /** Insert {{key}} at the cursor in the message. */
  const insertField = (key: string) => {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    const current = getValues("body") ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    setValue("body", next, { shouldDirty: true, shouldValidate: true });
    setTab("edit");
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const showPreview = () => {
    setTab("preview");
    setPreviewLoading(true);
    previewInvoiceEmailTemplate(getValues())
      .then((result) => {
        if (result.ok) setPreviewHtml(result.html);
        else toast.error(result.error);
      })
      .catch(() => toast.error("Could not render the preview."))
      .finally(() => setPreviewLoading(false));
  };

  const onSave = (values: InvoiceEmailValues) => {
    startSaving(async () => {
      const result = await saveInvoiceEmailTemplate(values);
      if (result.ok) {
        toast.success("Invoice email saved");
        reset(values);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const onReset = () => {
    if (!window.confirm("Replace your invoice email with the built-in default?")) return;
    startResetting(async () => {
      const result = await resetInvoiceEmailTemplate();
      if (result.ok) {
        toast.success("Invoice email reset to the default");
        reset(DEFAULT_INVOICE_EMAIL);
        setPreviewHtml(null);
        setTab("edit");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Card id="invoice-email">
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-brand">Invoice email</p>
          <p className="text-xs text-foreground-secondary">
            The email landlords receive with their invoice PDF. Your logo, colours and the
            invoice details panel are added automatically.{" "}
            {isDefault ? "You're using the built-in default." : null}{" "}
            {canConnectMailbox ? (
              <>
                Emails send from{" "}
                <Link href="/settings/email" className="underline hover:text-foreground">
                  your connected mailbox
                </Link>{" "}
                when you have one.
              </>
            ) : (
              "Emails send from the shared Harbor Ops mailer."
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="invoice-template-subject" className="text-sm font-medium text-foreground">
              Subject
            </label>
            <p className={hintCls}>Max 200 characters. Merge fields like {"{{invoice_number}}"} work here too.</p>
            <input
              id="invoice-template-subject"
              type="text"
              className={cn(inputCls, errors.subject ? "border-red-400" : "border-border")}
              {...register("subject")}
            />
            {errors.subject && <p className={errCls}>{errors.subject.message}</p>}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Merge fields</p>
            <p className={hintCls}>Click one to insert it into the message where your cursor is.</p>
            <div className="flex flex-wrap gap-1.5">
              {INVOICE_MERGE_FIELDS.map((field) => (
                <Tooltip key={field.key} content={`${field.label} — for example “${field.example}”.`}>
                  <button
                    type="button"
                    onClick={() => insertField(field.key)}
                    className="rounded-md border border-border bg-surface-inset px-2 py-1 font-mono text-[11px] text-foreground-secondary hover:text-foreground hover:border-border-strong"
                  >
                    {`{{${field.key}}}`}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>

          {unknownKeys.length > 0 ? (
            <div className="flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                {unknownKeys.map((k) => `{{${k}}}`).join(", ")} isn&apos;t a merge field, so it will
                be sent exactly as written. Use one of the fields above.
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-inset p-0.5 w-fit">
            <Tooltip content="Change the wording. Formatting tips are below the box.">
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
                Edit
              </button>
            </Tooltip>
            <Tooltip content="See the finished email with your branding, filled in with example invoice details.">
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
          </div>

          {/* Kept mounted while previewing so the field stays registered. */}
          <div className={cn("flex flex-col gap-1", tab === "preview" && "hidden")}>
            <label htmlFor="invoice-template-body" className="text-sm font-medium text-foreground">
              Message
            </label>
            <p className={hintCls}>
              Max 10,000 characters. Start with <code className="text-[10px]"># Heading</code> for
              the title, <code className="text-[10px]">## Heading</code> for a section,{" "}
              <code className="text-[10px]">- item</code> for a bullet and{" "}
              <code className="text-[10px]">**bold**</code>. A blank line starts a new paragraph.
            </p>
            <textarea
              id="invoice-template-body"
              rows={14}
              className={cn(
                inputCls,
                "font-mono text-[12.5px] leading-relaxed resize-y",
                errors.body ? "border-red-400" : "border-border"
              )}
              {...bodyField}
              ref={(el) => {
                bodyRegisterRef(el);
                bodyRef.current = el;
              }}
            />
            {errors.body && <p className={errCls}>{errors.body.message}</p>}
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
                  className="w-full h-[460px] border-0 bg-white"
                />
              ) : (
                <div className="h-[460px] flex items-center justify-center text-xs text-foreground-secondary">
                  No preview yet.
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 flex-wrap">
            {!isDefault ? (
              <Tooltip content="Discard your wording and go back to the built-in invoice email.">
                <Button type="button" variant="outline" onClick={onReset} loading={isResetting}>
                  <RotateCcw className="h-4 w-4" />
                  Reset to default
                </Button>
              </Tooltip>
            ) : null}
            <Tooltip content="Becomes the starting point for every invoice email. Invoices already sent are not affected.">
              <Button type="submit" variant="secondary" loading={isSaving} disabled={!isDirty && !isDefault}>
                <Save className="h-4 w-4" />
                Save invoice email
              </Button>
            </Tooltip>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
