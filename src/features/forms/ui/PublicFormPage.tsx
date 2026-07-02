"use client";

import { useState, useRef, useTransition } from "react";
import { ArrowRight, Check, Info as InfoIcon, AlertCircle, Paperclip, X, ShieldCheck } from "lucide-react";
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

const ACCEPTED = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif";
const MAX_FILES = 3;

function FileInput({
  files,
  onChange,
  invalid,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  invalid: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const remove = (i: number) => onChange(files.filter((_, idx) => idx !== i));

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const next = [...files, ...picked].slice(0, MAX_FILES);
    onChange(next);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="space-y-2">
      {files.map((f, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface-card/60 px-3.5 py-2.5 backdrop-blur-sm"
        >
          <Paperclip className="h-4 w-4 text-brand shrink-0" />
          <span className="text-sm text-foreground flex-1 truncate">{f.name}</span>
          <span className="text-xs text-foreground-muted shrink-0">
            {(f.size / 1024 / 1024).toFixed(1)} MB
          </span>
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {files.length < MAX_FILES && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-sm transition-colors ${
            invalid && files.length === 0
              ? "border-red-400 bg-red-50/30 text-red-500"
              : "border-border bg-surface-card/60 text-foreground-muted hover:border-brand/50 hover:text-foreground"
          } backdrop-blur-sm`}
        >
          <Paperclip className="h-4 w-4 shrink-0" />
          <span>
            {files.length === 0
              ? "Choose file — PDF, Word, or image (max 10 MB each)"
              : `Add another file (${MAX_FILES - files.length} remaining)`}
          </span>
          <input ref={ref} type="file" accept={ACCEPTED} className="sr-only" onChange={pick} />
        </button>
      )}
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  files,
  onFilesChange,
  invalid,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
  files: File[];
  onFilesChange: (f: File[]) => void;
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

  if (question_type === "confirm") {
    const confirmed = value === "Yes";
    return (
      <div
        className={`rounded-2xl border p-4 space-y-3 transition-colors ${
          invalid
            ? "border-red-300 bg-red-50/40"
            : confirmed
            ? "border-brand/40 bg-brand/[0.04]"
            : "border-border bg-surface-card"
        }`}
      >
        <div className="flex gap-2.5">
          <ShieldCheck
            className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${
              confirmed ? "text-brand" : "text-foreground-muted"
            }`}
          />
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {question.question_text}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(confirmed ? "" : "Yes")}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
            confirmed
              ? "border-brand bg-brand text-brand-fg shadow-sm"
              : "border-border bg-surface-inset text-foreground hover:border-brand/50 hover:bg-surface-card"
          }`}
        >
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-colors ${
              confirmed ? "border-brand-fg bg-white/20" : "border-border bg-surface-card"
            }`}
          >
            {confirmed && <Check className="h-2.5 w-2.5" />}
          </span>
          Yes, I confirm
        </button>
      </div>
    );
  }

  if (question_type === "file") {
    return <FileInput files={files} onChange={onFilesChange} invalid={invalid} />;
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
    const checked = value === "Yes";
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(checked ? "" : "Yes")}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
            checked
              ? "border-brand bg-brand/10 text-brand"
              : "border-border bg-surface-card text-foreground hover:border-brand/50 hover:bg-surface-inset"
          }`}
        >
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-colors ${
              checked ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface-inset"
            }`}
          >
            {checked && <Check className="h-2.5 w-2.5" />}
          </span>
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(value === "No" ? "" : "No")}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
            value === "No"
              ? "border-brand bg-brand/10 text-brand"
              : "border-border bg-surface-card text-foreground hover:border-brand/50 hover:bg-surface-inset"
          }`}
        >
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-colors ${
              value === "No" ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface-inset"
            }`}
          >
            {value === "No" && <Check className="h-2.5 w-2.5" />}
          </span>
          No
        </button>
      </div>
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
  token?: string;
}

export function PublicFormPage({ form, slug, token }: PublicFormPageProps) {
  const questions = [...(form.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [respondentPhone, setRespondentPhone] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) setErrors((prev) => ({ ...prev, [questionId]: false }));
  };

  const setQuestionFiles = (questionId: string, f: File[]) => {
    setFiles((prev) => ({ ...prev, [questionId]: f }));
    if (errors[questionId]) setErrors((prev) => ({ ...prev, [questionId]: false }));
  };

  const handleSubmit = () => {
    const newErrors: Record<string, boolean> = {};
    for (const q of questions) {
      if (q.question_type === "info") continue;
      const mustAnswer = q.is_required || q.question_type === "confirm";
      if (mustAnswer) {
        if (q.question_type === "file") {
          if (!files[q.id]?.length) newErrors[q.id] = true;
        } else {
          if (!answers[q.id]?.trim()) newErrors[q.id] = true;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    startTransition(async () => {
      try {
        setSubmitError(null);
        const fd = new FormData();
        fd.set("slug", slug);
        if (token) fd.set("token", token);
        fd.set("respondent_name", respondentName);
        fd.set("respondent_email", respondentEmail);
        fd.set("respondent_phone", respondentPhone);
        for (const q of questions) {
          if (q.question_type === "info") continue;
          if (q.question_type === "file") {
            for (const f of files[q.id] ?? []) fd.append(`file_${q.id}`, f);
          } else {
            fd.set(`answer_${q.id}`, answers[q.id] ?? "");
          }
        }
        await submitForm(fd);
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

      {questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              {q.question_type !== "info" && q.question_type !== "confirm" && (
                <label className="block text-sm font-medium text-foreground">
                  {q.question_text}
                  {q.is_required && <span className="ml-1 text-red-500">*</span>}
                </label>
              )}
              <QuestionInput
                question={q}
                value={answers[q.id] ?? ""}
                onChange={(v) => setAnswer(q.id, v)}
                files={files[q.id] ?? []}
                onFilesChange={(f) => setQuestionFiles(q.id, f)}
                invalid={!!errors[q.id]}
              />
              {errors[q.id] && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {q.question_type === "file" ? "Please attach a file" : "This field is required"}
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
