"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateContractFromTemplate } from "../actions/generate";
import {
  getTemplateManualFieldsAction,
  listContractTemplatesForBookingAction,
} from "../actions/templates";

type TemplateOption = { id: string; name: string; page_count: number; portfolio_id: string | null };

type ManualField = {
  id: string;
  label: string;
  manual_key: string | null;
  manual_default: string | null;
  sort_order: number;
};

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

export function CreateContractFromTemplateDialog({
  open,
  onClose,
  bookingId,
  portfolioId,
  responses = [],
  applicant,
}: Props) {
  const [showAnswers, setShowAnswers] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"pick" | "fill" | "done">("pick");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [manualFields, setManualFields] = useState<ManualField[]>([]);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Defaults
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState("");
  const [rentPcm, setRentPcm] = useState("");
  const [deposit, setDeposit] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("pick");
      setSelectedTemplateId("");
      setManualFields([]);
      setManualValues({});
      setResultUrl(null);
      setStartDate(today);
      setExpiryDate("");
      setRentPcm("");
      setDeposit("");
      setTemplates([]);
      setShowAnswers(false);
      return;
    }
    setLoadingTemplates(true);
    listContractTemplatesForBookingAction(portfolioId)
      .then((rows) => setTemplates(rows))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load templates"))
      .finally(() => setLoadingTemplates(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portfolioId]);

  const handlePickTemplate = (id: string) => {
    setSelectedTemplateId(id);
    startTransition(async () => {
      try {
        const manuals = await getTemplateManualFieldsAction(id);
        setManualFields(manuals);
        const defaults: Record<string, string> = {};
        for (const m of manuals) {
          if (m.manual_key) defaults[m.manual_key] = m.manual_default ?? "";
        }
        setManualValues(defaults);
        setStep("fill");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load template");
      }
    });
  };

  const handleSubmit = () => {
    const rentNum = Number(rentPcm);
    const depositNum = Number(deposit);
    if (!Number.isFinite(rentNum) || rentNum < 0) {
      toast.error("Rent PCM must be a positive number");
      return;
    }
    if (!Number.isFinite(depositNum) || depositNum < 0) {
      toast.error("Deposit must be a positive number");
      return;
    }
    if (!startDate) {
      toast.error("Start date is required");
      return;
    }

    startTransition(async () => {
      try {
        const { signedUrl } = await generateContractFromTemplate({
          templateId: selectedTemplateId,
          bookingId,
          manualValues,
          contractDefaults: {
            start_date: startDate,
            expiry_date: expiryDate || null,
            rent_pcm: Math.round(rentNum),
            deposit: Math.round(depositNum),
          },
        });
        setResultUrl(signedUrl);
        setStep("done");
        toast.success("Contract generated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Generation failed");
      }
    });
  };

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
            {loadingTemplates ? (
              <p className="text-sm text-foreground-secondary py-6 text-center">Loading templates…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-foreground-secondary py-6 text-center">
                No templates available
                {portfolioId ? " for this portfolio" : ""}. Upload one at /contracts/templates.
              </p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
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
              ))
            )}
          </div>
        )}

        {step === "fill" && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {answerRows.length > 0 && (
              <div className="rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setShowAnswers((v) => !v)}
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
                            className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
                          >
                            <ExternalLink size={13} />
                            View uploaded file
                          </a>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-foreground">
                            {r.value || "—"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Start date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Expiry date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Rent PCM (£) *</label>
                <input
                  type="number"
                  min={0}
                  value={rentPcm}
                  onChange={(e) => setRentPcm(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Deposit (£) *</label>
                <input
                  type="number"
                  min={0}
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            {manualFields.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">
                  Template-specific fields
                </p>
                {manualFields.map((f) => {
                  const key = f.manual_key ?? "";
                  return (
                    <div key={f.id} className="space-y-1">
                      <label className="text-xs font-medium text-foreground">{f.label}</label>
                      <input
                        value={manualValues[key] ?? ""}
                        onChange={(e) =>
                          setManualValues((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("pick")}>
                Back
              </Button>
              <Button variant="secondary" size="sm" onClick={handleSubmit} loading={isPending}>
                Generate contract
              </Button>
            </div>
          </div>
        )}

        {step === "done" && resultUrl && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-foreground">The draft contract has been updated with the generated PDF.</p>
            <a
              href={resultUrl}
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
