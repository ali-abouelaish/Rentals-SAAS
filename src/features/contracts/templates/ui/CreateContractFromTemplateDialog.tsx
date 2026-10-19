"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { getBookingContractSetup, type BookingContractSetup } from "@/features/bookings/actions/bookings";
import { generateContractFromTemplate } from "../actions/generate";
import { getTemplateManualFieldsAction } from "../actions/templates";
import {
  contractGenerationFormSchema,
  type ContractGenerationFormValues,
} from "../domain/schemas";
import {
  ContractTermsFields,
  ManualFieldsSection,
  manualRowsFor,
  manualValuesFrom,
} from "./ContractGenerationFields";

type ApplicantAnswer = {
  id: string;
  answer_text: string | null;
  answer_file_url: string | null;
  question?: { question_text: string } | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  portfolioId: string | null;
  /** The applicant's booking-form answers, shown read-only for reference. */
  responses?: ApplicantAnswer[];
  /** Built-in fields every booking form collects (stored on the booking, not as questions). */
  applicant?: { name: string | null; email: string | null; phone: string | null };
}

const ID_PREFIX = "gen-contract";

function emptyValues(): ContractGenerationFormValues {
  return {
    template_id: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    expiry_date: "",
    rent_pcm: "",
    deposit: "",
    manual: [],
  };
}

export function CreateContractFromTemplateDialog({
  open,
  onClose,
  bookingId,
  portfolioId,
  responses = [],
  applicant,
}: Props) {
  const router = useRouter();
  const [showAnswers, setShowAnswers] = useState(false);
  const [setup, setSetup] = useState<BookingContractSetup | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"pick" | "fill" | "done">("pick");
  const [result, setResult] = useState<{ documentUrl: string; warnings: string[] } | null>(null);

  const form = useForm<ContractGenerationFormValues>({
    resolver: zodResolver(contractGenerationFormSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) {
      setStep("pick");
      setResult(null);
      setSetup(null);
      setShowAnswers(false);
      form.reset(emptyValues());
      return;
    }
    setLoadingSetup(true);
    getBookingContractSetup(bookingId)
      .then((s) => {
        setSetup(s);
        // Prefill with the tenancy's current terms (or the agreed offer), so a
        // generation never silently replaces the rent with a blank.
        form.reset({
          ...emptyValues(),
          start_date: s.defaults.start_date ?? format(new Date(), "yyyy-MM-dd"),
          expiry_date: s.defaults.expiry_date ?? "",
          rent_pcm: s.defaults.rent_pcm != null ? String(s.defaults.rent_pcm) : "",
          deposit: s.defaults.deposit != null ? String(s.defaults.deposit) : "",
        });
      })
      .catch(() => toast.error("Couldn't load the contract templates. Close this and try again."))
      .finally(() => setLoadingSetup(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingId]);

  const lockedReason = setup?.contract?.lockedReason ?? null;
  const templates = setup?.templates ?? [];

  const handlePickTemplate = (id: string) => {
    startTransition(async () => {
      try {
        const prompts = await getTemplateManualFieldsAction(id);
        form.setValue("template_id", id);
        form.setValue("manual", manualRowsFor(prompts));
        form.clearErrors();
        setStep("fill");
      } catch {
        toast.error("Couldn't load that template. Please try again.");
      }
    });
  };

  const onSubmit = form.handleSubmit(
    (values) => {
      startTransition(async () => {
        const res = await generateContractFromTemplate({
          templateId: values.template_id,
          bookingId,
          manualValues: manualValuesFrom(values.manual),
          terms: {
            start_date: values.start_date,
            expiry_date: values.expiry_date || null,
            rent_pcm: Number(values.rent_pcm),
            deposit: Number(values.deposit),
            collection_date: null,
            deposit_scheme: null,
          },
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setResult({ documentUrl: res.documentUrl, warnings: res.warnings });
        setStep("done");
        toast.success(res.warnings.length ? "Contract generated — check the notes below" : "Contract generated");
        router.refresh();
      });
    },
    // Never fail silently: say why, even if the offending input is scrolled away.
    () => toast.error("Please fix the highlighted fields."),
  );

  // Built-in applicant fields (name/email/phone) live on the booking, not in
  // form_responses, so surface them ahead of the custom-question answers.
  type AnswerRow = { id: string; label: string; value: string | null; fileUrl: string | null };
  const builtinRows: AnswerRow[] = [
    { id: "builtin-name", label: "Full name", value: applicant?.name ?? null, fileUrl: null },
    { id: "builtin-email", label: "Email", value: applicant?.email ?? null, fileUrl: null },
    { id: "builtin-phone", label: "Phone", value: applicant?.phone ?? null, fileUrl: null },
  ].filter((r) => r.value);
  const answerRows: AnswerRow[] = [
    ...builtinRows,
    ...responses.map((r) => ({
      id: r.id,
      label: r.question?.question_text ?? "Question",
      value: r.answer_text,
      fileUrl: r.answer_file_url,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {step === "pick" && "Choose a contract template"}
            {step === "fill" && "Fill contract details"}
            {step === "done" && "Contract generated"}
          </DialogTitle>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {loadingSetup ? (
              <p className="text-sm text-foreground-secondary py-6 text-center">Loading templates…</p>
            ) : lockedReason ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{lockedReason}</p>
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-foreground-secondary py-6 text-center">
                No templates available
                {portfolioId ? " for this portfolio" : ""}. Upload one at /contracts/templates.
              </p>
            ) : (
              <>
                {setup?.contract?.hasPdf && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-surface-inset px-3 py-2 text-xs text-foreground-secondary">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                    This tenancy already has a generated contract. Generating again replaces its PDF and terms.
                  </p>
                )}
                {templates.map((t) => (
                  <Tooltip key={t.id} content="Stamp this booking's details onto this template. You'll confirm the terms next.">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handlePickTemplate(t.id)}
                      className="w-full text-left rounded-lg border border-border bg-surface-inset hover:bg-surface-card p-3 flex items-center gap-3 disabled:opacity-50"
                    >
                      <div className="h-9 w-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                        <p className="text-xs text-foreground-secondary">
                          {t.page_count} page{t.page_count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </button>
                  </Tooltip>
                ))}
              </>
            )}
          </div>
        )}

        {step === "fill" && (
          <FormProvider {...form}>
            <form onSubmit={onSubmit} noValidate className="space-y-4 max-h-[60vh] overflow-y-auto">
              {answerRows.length > 0 && (
                <div className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setShowAnswers((v) => !v)}
                    aria-expanded={showAnswers}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground-secondary">
                      Applicant&apos;s answers ({answerRows.length})
                    </span>
                    {showAnswers ? (
                      <ChevronDown size={14} className="text-foreground-muted" />
                    ) : (
                      <ChevronRight size={14} className="text-foreground-muted" />
                    )}
                  </button>
                  {showAnswers && (
                    <div className="space-y-3 border-t border-border px-3 py-3">
                      {answerRows.map((r) => (
                        <div key={r.id} className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                            {r.label}
                          </p>
                          {r.fileUrl ? (
                            <a
                              href={r.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 min-w-11 justify-center md:min-h-0 md:min-w-0 items-center gap-1 text-sm text-brand hover:underline"
                            >
                              <ExternalLink size={13} />
                              View uploaded file
                            </a>
                          ) : (
                            <p className="whitespace-pre-wrap text-sm text-foreground">{r.value || "—"}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <ContractTermsFields idPrefix={ID_PREFIX} disabled={isPending} />
              <ManualFieldsSection idPrefix={ID_PREFIX} disabled={isPending} />

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setStep("pick")} disabled={isPending}>
                  Back
                </Button>
                <Tooltip content="Creates the PDF and attaches it to the tenancy's contract. You can regenerate it while the contract is a draft.">
                  <Button type="submit" variant="secondary" size="sm" loading={isPending}>
                    Generate contract
                  </Button>
                </Tooltip>
              </div>
            </form>
          </FormProvider>
        )}

        {step === "done" && result && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-foreground">The contract has been updated with the generated PDF.</p>
            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" /> Check before sending
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <a
              href={result.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-foreground-link hover:underline"
            >
              Open PDF <ExternalLink size={14} />
            </a>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
