"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Download,
  Paperclip,
  User,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Form, FormQuestion, FormSubmission } from "../domain/types";

interface FormResponsesPageProps {
  form: Form;
  initialSubmissions: FormSubmission[];
}

function parseFilePaths(answerText: string | null): string[] {
  if (!answerText) return [];
  try {
    const parsed = JSON.parse(answerText);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [answerText];
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function exportCsv(form: Form, submissions: FormSubmission[]) {
  const questions = (form.questions ?? []).filter((q) => q.question_type !== "info" && q.question_type !== "file");
  const headers = ["Submitted", "Name", "Email", "Phone", ...questions.map((q) => q.question_text)];
  const rows = submissions.map((sub) => {
    const cells = [
      formatDate(sub.submitted_at),
      sub.respondent_name ?? "",
      sub.respondent_email ?? "",
      sub.respondent_phone ?? "",
      ...questions.map((q) => {
        const ans = (sub.answers ?? []).find((a) => a.question_id === q.id);
        return ans?.answer_text ?? "";
      }),
    ];
    return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
  });
  const csv = [headers.map((h) => `"${h}"`).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${form.name.toLowerCase().replace(/\s+/g, "-")}-responses.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function initials(name: string | null | undefined) {
  if (!name) return null;
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

function previewAnswer(sub: FormSubmission, questions: FormQuestion[]) {
  for (const q of questions) {
    if (q.question_type === "file") continue;
    const ans = (sub.answers ?? []).find((a) => a.question_id === q.id);
    if (ans?.answer_text?.trim()) {
      const text = ans.answer_text.trim();
      return text.length > 72 ? text.slice(0, 72) + "…" : text;
    }
  }
  return null;
}

function hasFiles(sub: FormSubmission, questions: FormQuestion[]) {
  return questions.some((q) => {
    if (q.question_type !== "file") return false;
    const ans = (sub.answers ?? []).find((a) => a.question_id === q.id);
    return !!ans?.answer_text;
  });
}

// ─── Submission list item ────────────────────────────────────────────────────

function SubmissionListItem({
  sub,
  questions,
  selected,
  onClick,
}: {
  sub: FormSubmission;
  questions: FormQuestion[];
  selected: boolean;
  onClick: () => void;
}) {
  const ini = initials(sub.respondent_name);
  const preview = previewAnswer(sub, questions);
  const files = hasFiles(sub, questions);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-border last:border-0 transition-colors flex gap-3 items-start ${
        selected
          ? "bg-brand/[0.06] border-l-2 border-l-brand"
          : "hover:bg-surface-inset/40 border-l-2 border-l-transparent"
      }`}
    >
      {/* Avatar */}
      <div
        className={`h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold mt-0.5 ${
          selected
            ? "text-brand-fg"
            : "bg-surface-inset text-foreground-muted"
        }`}
        style={
          selected
            ? { background: "color-mix(in oklab, var(--brand-primary) 80%, black)" }
            : undefined
        }
      >
        {ini ?? <User className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-medium truncate ${selected ? "text-foreground" : "text-foreground"}`}>
            {sub.respondent_name ?? <span className="italic text-foreground-muted">Anonymous</span>}
          </span>
          <span className="text-[11px] text-foreground-muted shrink-0">{formatDateShort(sub.submitted_at)}</span>
        </div>
        {sub.respondent_email && (
          <p className="text-xs text-foreground-muted truncate mt-0.5">{sub.respondent_email}</p>
        )}
        {preview && (
          <p className="text-xs text-foreground-secondary mt-1 line-clamp-2 leading-relaxed">{preview}</p>
        )}
        {files && (
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-brand">
            <Paperclip className="h-2.5 w-2.5" />
            Files attached
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────────

function SubmissionDetail({
  sub,
  questions,
}: {
  sub: FormSubmission;
  questions: FormQuestion[];
}) {
  const allQuestions = questions;

  return (
    <div className="flex flex-col h-full">
      {/* Respondent header */}
      <div className="px-6 py-5 border-b border-border bg-surface-inset/30">
        <div className="flex items-start gap-4">
          <div
            className="h-12 w-12 rounded-full shrink-0 flex items-center justify-center text-base font-semibold text-brand-fg"
            style={{ background: "color-mix(in oklab, var(--brand-primary) 80%, black)" }}
          >
            {initials(sub.respondent_name) ?? <User className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">
              {sub.respondent_name ?? <span className="italic text-foreground-muted font-normal">Anonymous</span>}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
              {sub.respondent_email && (
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
                  <Mail className="h-3 w-3 text-foreground-muted" />
                  {sub.respondent_email}
                </span>
              )}
              {sub.respondent_phone && (
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
                  <Phone className="h-3 w-3 text-foreground-muted" />
                  {sub.respondent_phone}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
                <Calendar className="h-3 w-3" />
                {formatDate(sub.submitted_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Answers */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {allQuestions.map((q) => {
          const ans = (sub.answers ?? []).find((a) => a.question_id === q.id);
          return (
            <div key={q.id}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted mb-1">
                {q.question_text}
                {q.is_required && <span className="ml-1 text-red-400">*</span>}
              </p>
              {q.question_type === "file" ? (
                ans?.answer_text ? (
                  <div className="flex flex-wrap gap-2">
                    {parseFilePaths(ans.answer_text).map((path, i) => (
                      <a
                        key={i}
                        href={`/api/forms/download?path=${encodeURIComponent(path)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground hover:bg-surface-inset transition-colors"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-brand" />
                        File {i + 1}
                        <Download className="h-3 w-3 text-foreground-muted" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground-muted italic">No file uploaded</p>
                )
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {ans?.answer_text || <span className="text-foreground-muted italic">—</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function FormResponsesPage({ form, initialSubmissions }: FormResponsesPageProps) {
  const [submissions] = useState<FormSubmission[]>(initialSubmissions);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSubmissions[0]?.id ?? null
  );
  const [showDetail, setShowDetail] = useState(false);

  const filtered = query.trim()
    ? submissions.filter((s) => {
        const q = query.toLowerCase();
        return (
          s.respondent_name?.toLowerCase().includes(q) ||
          s.respondent_email?.toLowerCase().includes(q) ||
          s.respondent_phone?.toLowerCase().includes(q)
        );
      })
    : submissions;

  const questions: FormQuestion[] = (form.questions ?? [])
    .filter((q) => q.question_type !== "info")
    .sort((a, b) => a.sort_order - b.sort_order);

  const selected = submissions.find((s) => s.id === selectedId) ?? null;

  const selectSub = (id: string) => {
    setSelectedId(id);
    setShowDetail(true);
  };

  return (
    <div className="space-y-5">
      {/* Nav */}
      <Link
        href={`/forms/${form.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to builder
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{form.name}</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {submissions.length} response{submissions.length === 1 ? "" : "s"}
          </p>
        </div>
        {submissions.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => exportCsv(form, submissions)}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Body */}
      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-card py-16 text-center">
          <p className="text-sm font-semibold text-foreground mb-1">No responses yet</p>
          <p className="text-xs text-foreground-secondary">
            Share the form link with clients and responses will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">

            {/* Left: list — hidden on mobile when detail is open */}
            <div className={`border-r border-border overflow-y-auto max-h-[calc(100vh-220px)] ${showDetail ? "hidden lg:block" : "block"}`}>
              <div className="sticky top-0 z-10 border-b border-border bg-surface-card">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, email or phone…"
                    className="w-full bg-transparent py-3 pl-9 pr-8 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="px-4 py-1.5 border-t border-border/50 bg-surface-inset/30">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">
                    {filtered.length} of {submissions.length} submission{submissions.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-foreground-muted">
                  No matches for &ldquo;{query}&rdquo;
                </div>
              ) : null}

              {filtered.map((sub) => (
                <SubmissionListItem
                  key={sub.id}
                  sub={sub}
                  questions={questions}
                  selected={selectedId === sub.id}
                  onClick={() => selectSub(sub.id)}
                />
              ))}
            </div>

            {/* Right: detail — full-width on mobile when open */}
            <div
              className={`overflow-y-auto max-h-[calc(100vh-220px)] ${showDetail ? "block" : "hidden lg:block"}`}
            >
              {selected ? (
                <>
                  {/* Mobile back button */}
                  <button
                    type="button"
                    onClick={() => setShowDetail(false)}
                    className="lg:hidden flex items-center gap-1.5 px-4 py-2.5 text-sm text-foreground-muted hover:text-foreground border-b border-border w-full bg-surface-inset/40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    All responses
                  </button>
                  <SubmissionDetail sub={selected} questions={questions} />
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-foreground-muted">
                  Select a response to view details
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
