"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { importBookingForm } from "../actions/form-import";
import { bulkCreateFormQuestions } from "../actions/form-questions";
import {
  QUESTION_TYPE_LABELS,
  type ParsedQuestion,
  type FormQuestion,
  type QuestionType,
} from "../domain/types";

const MAX_CHARS = 6000;

interface BookingFormImportDialogProps {
  formId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (questions: FormQuestion[]) => void;
}

export function BookingFormImportDialog({
  formId,
  open,
  onOpenChange,
  onImported,
}: BookingFormImportDialogProps) {
  const [step, setStep] = useState<"paste" | "preview">("paste");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [isParsing, startParsing] = useTransition();
  const [isImporting, startImporting] = useTransition();

  const handleParse = () => {
    if (!rawText.trim()) {
      toast.error("Paste your form questions first");
      return;
    }
    startParsing(async () => {
      try {
        const questions = await importBookingForm(rawText);
        if (questions.length === 0) {
          toast.error("No questions detected. Try pasting a cleaner copy of the form.");
          return;
        }
        setParsed(questions);
        setStep("preview");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse");
      }
    });
  };

  const handleImport = () => {
    startImporting(async () => {
      try {
        const created = await bulkCreateFormQuestions(formId, parsed);
        toast.success(`${parsed.length} question${parsed.length === 1 ? "" : "s"} imported`);
        onImported(created);
        handleClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to import");
      }
    });
  };

  const handleClose = () => {
    setStep("paste");
    setRawText("");
    setParsed([]);
    onOpenChange(false);
  };

  const updateParsedQuestion = (
    index: number,
    field: keyof ParsedQuestion,
    value: unknown
  ) => {
    setParsed((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            Import questions with AI
          </DialogTitle>
        </DialogHeader>

        {step === "paste" ? (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-foreground-secondary">
              Paste the text of your form questions below. The AI will detect each question,
              its type, and options.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Form questions</label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value.slice(0, MAX_CHARS))}
                rows={10}
                className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
                placeholder="Paste your form questions here…"
                autoFocus
              />
              <p className="text-[11px] text-foreground-muted text-right">
                {rawText.length} / {MAX_CHARS}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={isParsing}
                onClick={handleParse}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Parse with AI
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-foreground-secondary">
              Review and adjust the detected questions before importing.
            </p>

            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {parsed.map((q, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-surface-card p-3 space-y-2"
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground-muted">Label</label>
                    <input
                      value={q.label}
                      onChange={(e) => updateParsedQuestion(i, "label", e.target.value)}
                      className="h-8 w-full rounded-lg border border-border bg-surface-inset px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs font-medium text-foreground-muted">Type</label>
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateParsedQuestion(i, "type", e.target.value as QuestionType)
                        }
                        className="h-8 w-full rounded-lg border border-border bg-surface-inset px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                      >
                        {Object.entries(QUESTION_TYPE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground-muted">Required</label>
                      <select
                        value={q.is_required ? "true" : "false"}
                        onChange={(e) =>
                          updateParsedQuestion(i, "is_required", e.target.value === "true")
                        }
                        className="h-8 rounded-lg border border-border bg-surface-inset px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                      >
                        <option value="false">Optional</option>
                        <option value="true">Required</option>
                      </select>
                    </div>
                  </div>
                  {q.options && q.options.length > 0 && (
                    <p className="text-[11px] text-foreground-muted">
                      Options: {q.options.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("paste")}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isImporting}
                  onClick={handleImport}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Import {parsed.length} question{parsed.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
