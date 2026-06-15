"use client";

import { useState } from "react";
import { ArrowLeft, Download, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Form, FormQuestion, FormSubmission } from "../domain/types";

interface FormResponsesPageProps {
  form: Form;
  initialSubmissions: FormSubmission[];
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

function exportCsv(form: Form, submissions: FormSubmission[]) {
  const questions = (form.questions ?? []).filter((q) => q.question_type !== "info");
  const headers = [
    "Submitted",
    "Name",
    "Email",
    "Phone",
    ...questions.map((q) => q.question_text),
  ];

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

export function FormResponsesPage({ form, initialSubmissions }: FormResponsesPageProps) {
  const [submissions] = useState<FormSubmission[]>(initialSubmissions);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const questions: FormQuestion[] = (form.questions ?? []).filter(
    (q) => q.question_type !== "info"
  );

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-2">
        <Link
          href={`/forms/${form.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to builder
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{form.name}</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {submissions.length} response{submissions.length === 1 ? "" : "s"}
          </p>
        </div>
        {submissions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv(form, submissions)}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export CSV
          </Button>
        )}
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-card py-16 text-center">
          <p className="text-sm font-semibold text-foreground mb-1">No responses yet</p>
          <p className="text-xs text-foreground-secondary">
            Share the form link with clients and responses will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-inset/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide whitespace-nowrap">
                  Submitted
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide whitespace-nowrap">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide whitespace-nowrap">
                  Email
                </th>
                {questions.map((q) => (
                  <th
                    key={q.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide whitespace-nowrap max-w-[180px]"
                    title={q.question_text}
                  >
                    <span className="block truncate max-w-[160px]">{q.question_text}</span>
                  </th>
                ))}
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const expanded = expandedId === sub.id;
                return (
                  <>
                    <tr
                      key={sub.id}
                      className="border-b border-border last:border-0 hover:bg-surface-inset/30 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expanded ? null : sub.id)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-foreground-muted">
                        {formatDate(sub.submitted_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                        {sub.respondent_name ?? <span className="text-foreground-muted italic">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-foreground-secondary">
                        {sub.respondent_email ?? <span className="text-foreground-muted italic">—</span>}
                      </td>
                      {questions.map((q) => {
                        const ans = (sub.answers ?? []).find((a) => a.question_id === q.id);
                        return (
                          <td
                            key={q.id}
                            className="px-4 py-3 max-w-[180px]"
                            title={ans?.answer_text ?? ""}
                          >
                            <span className="block truncate text-foreground-secondary text-xs">
                              {ans?.answer_text ?? "—"}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3">
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-foreground-muted" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-foreground-muted" />
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${sub.id}-detail`} className="bg-surface-inset/20">
                        <td colSpan={4 + questions.length + 1} className="px-6 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted mb-2">
                                Respondent
                              </p>
                              <div className="space-y-1">
                                <p className="text-sm text-foreground">
                                  <span className="text-foreground-muted">Name: </span>
                                  {sub.respondent_name ?? "—"}
                                </p>
                                <p className="text-sm text-foreground">
                                  <span className="text-foreground-muted">Email: </span>
                                  {sub.respondent_email ?? "—"}
                                </p>
                                <p className="text-sm text-foreground">
                                  <span className="text-foreground-muted">Phone: </span>
                                  {sub.respondent_phone ?? "—"}
                                </p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted mb-2">
                                Answers
                              </p>
                              <div className="space-y-2">
                                {questions.map((q) => {
                                  const ans = (sub.answers ?? []).find(
                                    (a) => a.question_id === q.id
                                  );
                                  return (
                                    <div key={q.id}>
                                      <p className="text-[11px] font-medium text-foreground-muted">
                                        {q.question_text}
                                      </p>
                                      <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">
                                        {ans?.answer_text ?? "—"}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
