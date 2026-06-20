"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Check,
  Pencil,
  X,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Send,
  Sparkles,
  ArrowRight,
  ClipboardList,
  UserRound,
  Info as InfoIcon,
  ListChecks,
  FileBarChart2,
  ShieldCheck,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuestionEditor } from "./QuestionEditor";
import { FormSendDialog } from "./FormSendDialog";
import { GoogleFormImportDialog } from "./GoogleFormImportDialog";
import { createForm, updateForm, deleteForm, duplicateForm } from "../actions/forms";
import { formSchema, type FormValues } from "../domain/schemas";
import type { Form, FormQuestion } from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";
import type { Client } from "@/features/clients/domain/types";
import { QUESTION_TYPE_LABELS } from "@/lib/types/question";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface FormsBuilderPageProps {
  initialForms: Form[];
  portfolios: Portfolio[];
  clients: Pick<Client, "id" | "full_name" | "email">[];
  appUrl: string;
}

export function FormsBuilderPage({
  initialForms,
  portfolios,
  clients,
  appUrl,
}: FormsBuilderPageProps) {
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>(initialForms);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(
    initialForms[0]?.id ?? null
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedForm = useMemo(
    () => forms.find((f) => f.id === selectedFormId) ?? null,
    [forms, selectedFormId]
  );

  const createFormHook = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { is_active: true, portfolio_id: null },
  });

  const editFormHook = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  /* ── handlers ─────────────────────────────────────────────────────────── */

  const handleCreate = (values: FormValues) => {
    startTransition(async () => {
      try {
        const data = await createForm(values);
        toast.success("Form created");
        createFormHook.reset({ is_active: true, portfolio_id: null });
        setCreateOpen(false);
        // select the new form (will appear after router.refresh)
        setSelectedFormId(data.id);
        router.refresh();
      } catch {
        toast.error("Failed to create form");
      }
    });
  };

  const openHeaderEdit = () => {
    if (!selectedForm) return;
    editFormHook.reset({
      name: selectedForm.name,
      description: selectedForm.description ?? "",
      is_active: selectedForm.is_active,
      portfolio_id: selectedForm.portfolio_id ?? null,
    });
    setEditingHeader(true);
  };

  const handleUpdateHeader = (values: FormValues) => {
    if (!selectedForm) return;
    startTransition(async () => {
      try {
        await updateForm(selectedForm.id, values);
        const portfolio = portfolios.find((p) => p.id === values.portfolio_id) ?? null;
        setForms((prev) =>
          prev.map((f) =>
            f.id === selectedForm.id
              ? {
                  ...f,
                  name: values.name,
                  description: values.description ?? null,
                  is_active: values.is_active,
                  portfolio_id: values.portfolio_id ?? null,
                  portfolio,
                }
              : f
          )
        );
        toast.success("Form updated");
        setEditingHeader(false);
      } catch {
        toast.error("Failed to update form");
      }
    });
  };

  const handleToggleActive = (form: Form) => {
    startTransition(async () => {
      try {
        await updateForm(form.id, { is_active: !form.is_active });
        setForms((prev) =>
          prev.map((f) => (f.id === form.id ? { ...f, is_active: !f.is_active } : f))
        );
        toast.success(form.is_active ? "Form deactivated" : "Form activated");
      } catch {
        toast.error("Failed to update form");
      }
    });
  };

  const handleDuplicate = (form: Form) => {
    startTransition(async () => {
      try {
        await duplicateForm(form.id);
        toast.success("Form duplicated");
        router.refresh();
      } catch {
        toast.error("Failed to duplicate form");
      }
    });
  };

  const handleDelete = (form: Form) => {
    startTransition(async () => {
      try {
        await deleteForm(form.id);
        setForms((prev) => prev.filter((f) => f.id !== form.id));
        if (selectedFormId === form.id) setSelectedFormId(forms.find((f) => f.id !== form.id)?.id ?? null);
        setDeletingId(null);
        toast.success("Form deleted");
      } catch {
        toast.error("Failed to delete form");
      }
    });
  };

  const copyLink = (slug: string) => {
    const url = `${appUrl}/f/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleQuestionsChange = (questions: FormQuestion[]) => {
    if (!selectedForm) return;
    setForms((prev) =>
      prev.map((f) => (f.id === selectedForm.id ? { ...f, questions } : f))
    );
  };

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Forms</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Build and send customisable forms — referencing checks, onboarding, enquiries.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New form
        </Button>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,400px)] gap-5 items-start">
        {/* ── Left: form list ───────────────────────────────────────────── */}
        <div className="space-y-2">
          {forms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <ListChecks className="h-7 w-7 text-foreground-muted mx-auto mb-2" />
              <p className="text-sm text-foreground-muted">No forms yet.</p>
            </div>
          ) : (
            forms.map((form) => (
              <button
                key={form.id}
                type="button"
                onClick={() => {
                  setSelectedFormId(form.id);
                  setEditingHeader(false);
                }}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  selectedFormId === form.id
                    ? "border-brand bg-brand/5"
                    : "border-border bg-surface-card hover:bg-surface-inset"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {form.portfolio && (
                      <span
                        className="inline-flex items-center mb-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: form.portfolio.color + "22",
                          color: form.portfolio.color,
                        }}
                      >
                        {form.portfolio.name}
                      </span>
                    )}
                    <p className="text-sm font-medium text-foreground truncate">{form.name}</p>
                  </div>
                  <span
                    className={`text-[10px] font-medium shrink-0 rounded-full px-2 py-0.5 ${
                      form.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {form.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-[11px] text-foreground-muted mt-1 truncate">
                  /f/{form.public_slug}
                </p>
              </button>
            ))
          )}
        </div>

        {/* ── Center: editor ────────────────────────────────────────────── */}
        {selectedForm ? (
          <div className="rounded-xl border border-border bg-surface-card p-5 space-y-5">
            {/* Header */}
            {editingHeader ? (
              <form
                onSubmit={editFormHook.handleSubmit(handleUpdateHeader)}
                className="space-y-3 rounded-lg border border-brand/30 bg-brand/[0.04] p-4"
              >
                <FormField
                  label="Form name *"
                  error={editFormHook.formState.errors.name?.message}
                >
                  <input {...editFormHook.register("name")} className={inputCls} autoFocus />
                </FormField>
                <FormField label="Description">
                  <textarea
                    {...editFormHook.register("description")}
                    rows={2}
                    className={`${inputCls} h-auto py-2`}
                  />
                </FormField>
                {portfolios.length > 0 && (
                  <FormField label="Portfolio">
                    <select {...editFormHook.register("portfolio_id")} className={selectCls}>
                      <option value="">No portfolio (global form)</option>
                      {portfolios.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingHeader(false)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancel
                  </Button>
                  <Button type="submit" variant="secondary" size="sm" loading={isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Save
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-foreground">
                      {selectedForm.name}
                    </h2>
                    {selectedForm.portfolio && (
                      <span
                        className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: selectedForm.portfolio.color + "22",
                          color: selectedForm.portfolio.color,
                        }}
                      >
                        {selectedForm.portfolio.name}
                      </span>
                    )}
                  </div>
                  {selectedForm.description && (
                    <p className="text-sm text-foreground-secondary mt-0.5">
                      {selectedForm.description}
                    </p>
                  )}
                  <p className="text-[11px] text-foreground-muted mt-1">
                    /f/{selectedForm.public_slug}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openHeaderEdit}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(selectedForm.public_slug)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy link
                  </Button>
                  <a
                    href={`${appUrl}/f/${selectedForm.public_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-inset transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSendOpen(true)}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Send
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setImportOpen(true)}
                    title="Import from Google Forms"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Import
                  </Button>
                  <Link
                    href={`/forms/${selectedForm.id}/responses`}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-inset transition-colors"
                  >
                    <FileBarChart2 className="h-3.5 w-3.5" />
                    Responses
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(selectedForm)}
                    disabled={isPending}
                    title={selectedForm.is_active ? "Deactivate form" : "Activate form"}
                  >
                    {selectedForm.is_active ? (
                      <ToggleRight className="h-5 w-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-foreground-muted" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(selectedForm)}
                    disabled={isPending}
                    title="Duplicate form"
                    className="text-foreground-muted hover:text-foreground transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(selectedForm.id)}
                    disabled={isPending}
                    title="Delete form"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-border" />

            <QuestionEditor
              formId={selectedForm.id}
              questions={selectedForm.questions ?? []}
              onQuestionsChange={handleQuestionsChange}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <ListChecks className="h-8 w-8 text-foreground-muted mx-auto mb-2" />
            <p className="text-sm text-foreground-muted">Select a form to edit</p>
          </div>
        )}

        {/* ── Right: live preview ───────────────────────────────────────── */}
        {selectedForm && (
          <div className="xl:sticky xl:top-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-secondary">
                <Sparkles className="h-3 w-3 text-brand" />
                Live preview
              </span>
              <span className="text-[11px] text-foreground-muted">How respondents see it</span>
            </div>
            <FormPreview form={selectedForm} />
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Form</DialogTitle>
          </DialogHeader>
          <form onSubmit={createFormHook.handleSubmit(handleCreate)} className="space-y-4 mt-2">
            <FormField
              label="Form name *"
              error={createFormHook.formState.errors.name?.message}
            >
              <input
                {...createFormHook.register("name")}
                className={inputCls}
                placeholder="e.g. Reference Check"
                autoFocus
              />
            </FormField>
            <FormField label="Description">
              <textarea
                {...createFormHook.register("description")}
                rows={2}
                className={`${inputCls} h-auto py-2`}
                placeholder="Brief description of this form…"
              />
            </FormField>
            {portfolios.length > 0 && (
              <FormField label="Portfolio">
                <select {...createFormHook.register("portfolio_id")} className={selectCls}>
                  <option value="">No portfolio (global form)</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="secondary" size="sm" loading={isPending}>
                <Check className="h-3.5 w-3.5 mr-1" />
                Create form
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      {deletingId && (
        <Dialog open onOpenChange={() => setDeletingId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete form?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-foreground-secondary mt-1">
              This will permanently delete the form and all its responses. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={isPending}
                onClick={() => {
                  const form = forms.find((f) => f.id === deletingId);
                  if (form) handleDelete(form);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Send dialog */}
      {selectedForm && (
        <FormSendDialog
          formId={selectedForm.id}
          formName={selectedForm.name}
          clients={clients}
          open={sendOpen}
          onOpenChange={setSendOpen}
        />
      )}

      {/* Google Forms import */}
      {selectedForm && (
        <GoogleFormImportDialog
          formId={selectedForm.id}
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={(newQuestions) => {
            handleQuestionsChange([...(selectedForm.questions ?? []), ...newQuestions]);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ── Live preview ──────────────────────────────────────────────────────────── */

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

function FormPreview({ form }: { form: Form }) {
  const items = [...(form.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const questionCount = items.filter((i) => i.question_type !== "info").length;

  return (
    <div className="rounded-2xl border border-border bg-surface-ground p-5 shadow-inner space-y-6">
      {/* Title */}
      <div>
        {form.portfolio && (
          <span
            className="inline-flex items-center mb-2 rounded-md font-semibold tracking-wide uppercase px-1.5 py-0.5 text-[10px]"
            style={{
              backgroundColor: `${form.portfolio.color}22`,
              color: form.portfolio.color,
              border: `1px solid ${form.portfolio.color}44`,
            }}
          >
            {form.portfolio.name}
          </span>
        )}
        <h1
          className="text-[1.5rem] leading-[1.1] tracking-[-0.01em] text-foreground"
          style={{ ...SERIF, fontWeight: 500 }}
        >
          {form.name}
        </h1>
        {form.description && (
          <p className="mt-2 text-xs text-foreground-secondary">{form.description}</p>
        )}
      </div>

      {/* Respondent details */}
      <div>
        <PreviewEyebrow icon={<UserRound className="h-3 w-3" />} label="Your details" />
        <div className="rounded-2xl border border-border bg-surface-card p-4 shadow-sm space-y-3">
          <PreviewInput label="Full name" placeholder="Jane Smith" />
          <div className="grid grid-cols-2 gap-2">
            <PreviewInput label="Email" placeholder="jane@example.com" />
            <PreviewInput label="Phone" placeholder="+44 7000 000000" />
          </div>
        </div>
      </div>

      {/* Questions + info blocks */}
      {items.length > 0 && (
        <div>
          <PreviewEyebrow
            icon={<ClipboardList className="h-3 w-3" />}
            label={`${questionCount} question${questionCount === 1 ? "" : "s"}`}
          />
          <div className="space-y-2.5">
            {items.map((item) => (
              <PreviewItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Submit button */}
      <div
        className="relative overflow-hidden rounded-2xl px-4 py-3.5 text-brand-fg shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)]"
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
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
              <Sparkles className="h-4 w-4" />
            </span>
            <span
              className="text-[0.95rem] leading-tight"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              Submit response
            </span>
          </div>
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function PreviewEyebrow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-border bg-surface-card/80 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-foreground-secondary">
      <span className="text-brand">{icon}</span>
      {label}
    </div>
  );
}

function PreviewInput({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <span className="block text-[9px] font-medium uppercase tracking-[0.14em] text-foreground-muted mb-1">
        {label}
      </span>
      <div className="h-9 w-full rounded-xl border border-border bg-surface-inset/40 px-3 flex items-center text-[11px] text-foreground-muted">
        {placeholder}
      </div>
    </div>
  );
}

function PreviewItem({ item }: { item: FormQuestion }) {
  if (item.question_type === "info") {
    return (
      <div className="flex gap-2.5 rounded-2xl border border-dashed border-brand/30 bg-brand/[0.04] p-3">
        <InfoIcon className="h-3.5 w-3.5 text-brand mt-0.5 shrink-0" />
        <p className="text-[11.5px] leading-relaxed text-foreground whitespace-pre-wrap">
          {item.question_text}
        </p>
      </div>
    );
  }

  if (item.question_type === "confirm") {
    return (
      <div className="rounded-2xl border border-border bg-surface-card p-3.5 space-y-2.5">
        <div className="flex gap-2">
          <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-foreground-muted" />
          <p className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
            {item.question_text}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-inset px-3 py-1.5 text-[11px] text-foreground-secondary">
          <span className="inline-block h-3 w-3 rounded border border-border bg-surface-card" />
          Yes, I confirm
        </div>
      </div>
    );
  }

  const displayType =
    item.question_type === "select"
      ? "Dropdown"
      : item.question_type === "checkbox"
      ? "Yes / no"
      : item.question_type === "textarea"
      ? "Long text"
      : item.question_type === "file"
      ? "File upload"
      : QUESTION_TYPE_LABELS[item.question_type] ?? null;

  return (
    <div className="rounded-2xl border border-border bg-surface-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-foreground flex-1">
          {item.question_text}
          {item.is_required && <span className="ml-1 text-red-500">*</span>}
        </p>
        {displayType && (
          <span className="text-[9px] text-foreground-muted uppercase tracking-wide shrink-0">
            {displayType}
          </span>
        )}
      </div>
      {item.question_type === "textarea" ? (
        <div className="mt-2 h-14 rounded-xl border border-border bg-surface-inset/40" />
      ) : item.question_type === "checkbox" ? (
        <div className="mt-2 flex gap-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-3 py-1.5 text-[11px] text-foreground-secondary">
            <span className="inline-block h-3 w-3 rounded border border-border bg-surface-inset" />
            Yes
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-3 py-1.5 text-[11px] text-foreground-secondary">
            <span className="inline-block h-3 w-3 rounded border border-border bg-surface-inset" />
            No
          </div>
        </div>
      ) : item.question_type === "select" ? (
        <div className="mt-2 h-8 rounded-xl border border-border bg-surface-inset/40 px-3 flex items-center text-[11px] text-foreground-muted">
          {(item.options && item.options[0]) || "Select an option…"}
        </div>
      ) : (
        <div className="mt-2 h-8 rounded-xl border border-border bg-surface-inset/40" />
      )}
    </div>
  );
}
