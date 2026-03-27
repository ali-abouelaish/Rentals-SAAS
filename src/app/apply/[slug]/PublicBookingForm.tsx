"use client";

import { useState, useTransition } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitBookingForm } from "@/features/booking-forms/actions/form-responses";
import type { BookingForm, FormQuestion } from "@/features/booking-forms/domain/types";

interface PublicBookingFormProps {
  form: BookingForm;
  slug: string;
  preselectedUnitId?: string;
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputCls =
    "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

  switch (question.question_type) {
    case "textarea":
      return (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} resize-none`}
        />
      );
    case "select":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="">Select an option…</option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={question.id}
            checked={value === "yes"}
            onChange={(e) => onChange(e.target.checked ? "yes" : "no")}
            className="h-4 w-4 rounded border-border accent-brand"
          />
          <label htmlFor={question.id} className="text-sm text-foreground">Yes</label>
        </div>
      );
    case "date":
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    case "number":
      return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    case "email":
      return <input type="email" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    case "phone":
      return <input type="tel" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    default:
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
  }
}

export function PublicBookingForm({ form, slug, preselectedUnitId }: PublicBookingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core applicant fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Dynamic question answers: questionId → answer text
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const questions = form.questions ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill in your name, email and phone number.");
      return;
    }

    startTransition(async () => {
      try {
        const answerPayload = questions.map((q) => ({
          question_id: q.id,
          answer_text: answers[q.id] ?? "",
        }));

        await submitBookingForm(
          slug,
          {
            unit_id: preselectedUnitId,
            applicant_name: name.trim(),
            applicant_email: email.trim(),
            applicant_phone: phone.trim(),
          },
          answerPayload
        );
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
      }
    });
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-10 text-center space-y-3">
        <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
        <h2 className="text-xl font-bold text-green-800">Application submitted!</h2>
        <p className="text-sm text-green-700">
          Thank you for your application. We will be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{form.name}</h1>
        {form.description && (
          <p className="text-sm text-foreground-secondary mt-1.5">{form.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Core applicant fields */}
        <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Your details</h2>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Full name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="John Smith"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Email address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Phone number *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="+44 7000 000000"
            />
          </div>
        </div>

        {/* Dynamic questions */}
        {questions.length > 0 && (
          <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Application questions</h2>
            {questions.map((q) => (
              <div key={q.id} className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {q.question_text}
                  {q.is_required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <QuestionInput
                  question={q}
                  value={answers[q.id] ?? ""}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          loading={isPending}
          className="w-full"
          size="lg"
        >
          Submit Application
        </Button>

        <p className="text-center text-xs text-foreground-muted">
          By submitting this form you consent to us processing your data in connection with your rental application.
        </p>
      </form>
    </div>
  );
}
