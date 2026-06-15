"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, Info as InfoIcon, AlertCircle } from "lucide-react";
import { submitForm } from "../actions/form-submit";
import type { Form, FormQuestion } from "../domain/types";

const inputCls = (invalid: boolean) =>
  `h-10 w-full rounded-xl border ${
    invalid ? "border-red-400 bg-red-50/30" : "border-border bg-surface-card/60"
  } px-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand backdrop-blur-sm`;

const textareaCls = (invalid: boolean) =>
  `w-full rounded-xl border ${
    invalid ? "border-red-400 bg-red-50/30" : "border-border bg-surface-card/60"
  } px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none backdrop-blur-sm`;

const selectCls = (invalid: boolean) =>
  `h-10 w-full rounded-xl border ${
    invalid ? "border-red-400 bg-red-50/30" : "border-border bg-surface-card/60"
  } px-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand backdrop-blur-sm`;

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

function QuestionInput({
  question,
  value,
  onChange,
  invalid,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  const { question_type, options } = question;

  if (question_type === "info") {
    return (
      <div className="flex gap-2.5 rounded-2xl border border-dashed border-brand/30 bg-brand/[0.04] p-3.5">
        <InfoIcon className="h-4 w-4 text-brand mt-0.5 shrink-0" />
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {question.question_text}
        </p>
      </div>
    );
  }

  if (question_type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className={textareaCls(invalid)}
        placeholder="Your answer…"
      />
    );
  }

  if (question_type === "select" && options && options.length > 0) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls(invalid)}>
        <option value="">Select an option…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (question_type === "checkbox") {
    return (
      <label className="inline-flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value === "Yes"}
          onChange={(e) => onChange(e.target.checked ? "Yes" : "")}
          className="h-4 w-4 rounded border-border text-brand focus:ring-brand/20"
        />
        <span className="text-sm text-foreground">Yes</span>
      </label>
    );
  }

  const inputType =
    question_type === "email"
      ? "email"
      : question_type === "phone"
      ? "tel"
      : question_type === "date"
      ? "date"
      : question_type === "number"
      ? "number"
      : "text";

  return (
    <input
      type={inputType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls(invalid)}
      placeholder="Your answer…"
    />
  );
}

interface PublicFormPageProps {
  form: Form;
  slug: string;
}

export function PublicFormPage({ form, slug }: PublicFormPageProps) {
  const questions = [...(form.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [respondentPhone, setRespondentPhone] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, boolean> = {};
    for (const q of questions) {
      if (q.question_type === "info") continue;
      if (q.is_required && !answers[q.id]?.trim()) {
        newErrors[q.id] = true;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    startTransition(async () => {
      try {
        setSubmitError(null);
        await submitForm(
          slug,
          {
            respondent_name: respondentName || undefined,
            respondent_email: respondentEmail || undefined,
            respondent_phone: respondentPhone || undefined,
          },
          questions
            .filter((q) => q.question_type !== "info")
            .map((q) => ({
              question_id: q.id,
              answer_text: answers[q.id] || undefined,
            }))
        );
        setSubmitted(true);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to submit");
      }
    });
  };

  if (submitted) {
    return (
      <div className="py-16 text-center space-y-4">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "color-mix(in oklab, var(--brand-primary) 15%, transparent)" }}
        >
          <Check className="h-8 w-8" style={{ color: "var(--brand-primary)" }} />
        </div>
        <div>
          <h2
            className="text-2xl tracking-tight text-foreground"
            style={{ ...SERIF, fontWeight: 500 }}
          >
            Thank you!
          </h2>
          <p className="mt-2 text-sm text-foreground-secondary">
            Your response has been submitted. We'll be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1
          className="text-[2rem] leading-[1.1] tracking-[-0.01em] text-foreground"
          style={{ ...SERIF, fontWeight: 500 }}
        >
          {form.name}
        </h1>
        {form.description && (
          <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">
            {form.description}
          </p>
        )}
      </div>

      {/* Respondent details */}
      <div className="rounded-2xl border border-border bg-surface-card/60 backdrop-blur-sm p-5 space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
          Your details
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Full name</label>
          <input
            type="text"
            value={respondentName}
            onChange={(e) => setRespondentName(e.target.value)}
            className={inputCls(false)}
            placeholder="Jane Smith"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={respondentEmail}
              onChange={(e) => setRespondentEmail(e.target.value)}
              className={inputCls(false)}
              placeholder="jane@example.com"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Phone</label>
            <input
              type="tel"
              value={respondentPhone}
              onChange={(e) => setRespondentPhone(e.target.value)}
              className={inputCls(false)}
              placeholder="+44 7000 000000"
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      {questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              {q.question_type !== "info" && (
                <label className="block text-sm font-medium text-foreground">
                  {q.question_text}
                  {q.is_required && <span className="ml-1 text-red-500">*</span>}
                </label>
              )}
              <QuestionInput
                question={q}
                value={answers[q.id] ?? ""}
                onChange={(v) => setAnswer(q.id, v)}
                invalid={!!errors[q.id]}
              />
              {errors[q.id] && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  This field is required
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="relative w-full overflow-hidden rounded-2xl px-5 py-4 text-brand-fg shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)] transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-primary) 0%, color-mix(in oklab, var(--brand-primary) 75%, black) 100%)",
        }}
      >
        <span
          aria-hidden
          className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-40 blur-3xl"
          style={{ background: "color-mix(in oklab, var(--brand-accent) 70%, transparent)" }}
        />
        <div className="relative flex items-center justify-between">
          <span className="text-[1rem] leading-tight" style={{ ...SERIF, fontWeight: 500 }}>
            {isPending ? "Submitting…" : "Submit form"}
          </span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </button>
    </div>
  );
}
