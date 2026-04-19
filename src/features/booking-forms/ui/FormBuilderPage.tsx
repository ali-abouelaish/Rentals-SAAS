"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Copy,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ExternalLink,
  Check,
  Pencil,
  X,
  Home,
  Landmark,
  Info as InfoIcon,
  Sparkles,
  ArrowRight,
  UserRound,
  ClipboardList,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuestionEditor } from "./QuestionEditor";
import {
  createBookingForm,
  updateBookingForm,
  deleteBookingForm,
} from "../actions/booking-forms";
import { bookingFormSchema, type BookingFormValues } from "../domain/schemas";
import type { BookingForm, FormQuestion } from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";

const inputCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface FormBuilderPageProps {
  initialForms: BookingForm[];
  portfolios: Portfolio[];
  appUrl: string;
}

export function FormBuilderPage({ initialForms, portfolios, appUrl }: FormBuilderPageProps) {
  const router = useRouter();
  const [forms, setForms] = useState<BookingForm[]>(initialForms);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(
    initialForms[0]?.id ?? null
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedForm = useMemo(
    () => forms.find((f) => f.id === selectedFormId) ?? null,
    [forms, selectedFormId]
  );

  const createFormHook = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { is_active: true, portfolio_id: portfolios[0]?.id ?? "" },
  });

  const editFormHook = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
  });

  const handleCreate = (values: BookingFormValues) => {
    startTransition(async () => {
      try {
        await createBookingForm(values);
        toast.success("Form created");
        createFormHook.reset({ is_active: true, portfolio_id: portfolios[0]?.id ?? "" });
        setCreateOpen(false);
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
      portfolio_id: selectedForm.portfolio_id ?? "",
      is_active: selectedForm.is_active,
    });
    setEditingHeader(true);
  };

  const handleUpdateHeader = (values: BookingFormValues) => {
    if (!selectedForm) return;
    startTransition(async () => {
      try {
        await updateBookingForm(selectedForm.id, values);
        const portfolio = portfolios.find((p) => p.id === values.portfolio_id);
        setForms((prev) =>
          prev.map((f) =>
            f.id === selectedForm.id
              ? {
                  ...f,
                  name: values.name,
                  description: values.description ?? null,
                  portfolio_id: values.portfolio_id,
                  portfolio: portfolio
                    ? { name: portfolio.name, color: portfolio.color }
                    : null,
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

  const handleToggleActive = (form: BookingForm) => {
    startTransition(async () => {
      try {
        await updateBookingForm(form.id, { is_active: !form.is_active });
        setForms((prev) =>
          prev.map((f) => (f.id === form.id ? { ...f, is_active: !f.is_active } : f))
        );
        toast.success(form.is_active ? "Form deactivated" : "Form activated");
      } catch {
        toast.error("Failed to update form");
      }
    });
  };

  const handleDelete = (form: BookingForm) => {
    startTransition(async () => {
      try {
        await deleteBookingForm(form.id);
        setForms((prev) => prev.filter((f) => f.id !== form.id));
        if (selectedFormId === form.id) setSelectedFormId(null);
        toast.success("Form deleted");
      } catch {
        toast.error("Failed to delete form");
      }
    });
  };

  const copyLink = (slug: string) => {
    const url = `${appUrl}/apply/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleQuestionsChange = (questions: FormQuestion[]) => {
    if (!selectedForm) return;
    setForms((prev) =>
      prev.map((f) => (f.id === selectedForm.id ? { ...f, questions } : f))
    );
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Booking Forms</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Build public-facing forms for rental applicants — one per portfolio.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={portfolios.length === 0}>
          <Plus className="h-4 w-4 mr-1.5" />
          New form
        </Button>
      </div>

      {portfolios.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Create a portfolio first — every booking form must belong to one so applications route correctly.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,420px)] gap-5 items-start">
        {/* Form list */}
        <div className="space-y-2">
          {forms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
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
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{form.name}</p>
                    {form.portfolio && (
                      <span
                        className="inline-flex items-center mt-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: form.portfolio.color + "22", color: form.portfolio.color }}
                      >
                        {form.portfolio.name}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium shrink-0 rounded-full px-2 py-0.5 ${
                    form.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {form.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-[11px] text-foreground-muted mt-1">
                  /apply/{form.public_slug}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Editor panel */}
        {selectedForm ? (
          <div className="rounded-xl border border-border bg-surface-card p-5 space-y-5">
            {editingHeader ? (
              <form
                onSubmit={editFormHook.handleSubmit(handleUpdateHeader)}
                className="space-y-3 rounded-lg border border-brand/30 bg-brand/[0.04] p-4"
              >
                <FormField label="Form name *" error={editFormHook.formState.errors.name?.message}>
                  <input {...editFormHook.register("name")} className={inputCls} />
                </FormField>
                <FormField label="Description">
                  <textarea
                    {...editFormHook.register("description")}
                    rows={2}
                    className={`${inputCls} h-auto py-2`}
                  />
                </FormField>
                <FormField
                  label="Portfolio *"
                  error={editFormHook.formState.errors.portfolio_id?.message}
                >
                  <select {...editFormHook.register("portfolio_id")} className={selectCls}>
                    <option value="">Select a portfolio…</option>
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </FormField>
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">{selectedForm.name}</h2>
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
                    <p className="text-sm text-foreground-secondary mt-0.5">{selectedForm.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={openHeaderEdit}>
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
                    href={`${appUrl}/apply/${selectedForm.public_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-inset transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
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
                    onClick={() => handleDelete(selectedForm)}
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
            <p className="text-sm text-foreground-muted">Select a form to edit</p>
          </div>
        )}

        {/* Live preview */}
        {selectedForm && (
          <div className="xl:sticky xl:top-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-secondary">
                <Sparkles className="h-3 w-3 text-brand" />
                Live preview
              </span>
              <span className="text-[11px] text-foreground-muted">How applicants see it</span>
            </div>
            <FormPreview form={selectedForm} />
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Booking Form</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createFormHook.handleSubmit(handleCreate)}
            className="space-y-4 mt-2"
          >
            <FormField label="Form name *" error={createFormHook.formState.errors.name?.message}>
              <input
                {...createFormHook.register("name")}
                className={inputCls}
                placeholder="e.g. FENIX — Standard Application"
                autoFocus
              />
            </FormField>
            <FormField label="Description">
              <textarea
                {...createFormHook.register("description")}
                rows={2}
                className={`${inputCls} h-auto py-2`}
                placeholder="Brief description shown to applicants…"
              />
            </FormField>
            <FormField
              label="Portfolio *"
              error={createFormHook.formState.errors.portfolio_id?.message}
            >
              <select {...createFormHook.register("portfolio_id")} className={selectCls}>
                <option value="">Select a portfolio…</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-foreground-muted mt-0.5">
                Every booking from this form will be attached to this portfolio.
              </p>
            </FormField>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" variant="secondary" size="sm" loading={isPending}>
                <Check className="h-3.5 w-3.5 mr-1" />
                Create form
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Live preview (non-interactive mirror of PublicBookingForm) ─────────────

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

function FormPreview({ form }: { form: BookingForm }) {
  const items = [...(form.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const questionCount = items.filter((i) => i.question_type !== "info").length;

  return (
    <div className="rounded-2xl border border-border bg-surface-ground p-5 shadow-inner space-y-6">
      {/* Title */}
      <div>
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

      {/* Placeholder room card */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-surface-card p-4 shadow-sm"
        style={{
          backgroundImage:
            "radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--brand-primary) 10%, transparent), transparent 55%)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <Home className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
              You're applying for
            </p>
            <p
              className="mt-0.5 text-[1rem] leading-tight tracking-[-0.005em] text-foreground"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              Room 3 · Double
            </p>
            <p className="mt-0.5 text-[11px] text-foreground-secondary">
              12 Example Street, London, E1 6AN
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface-inset/50 p-2.5">
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
              Monthly rent
            </span>
            <p
              className="mt-0.5 text-[0.95rem] leading-none text-foreground"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              £950
              <span className="ml-1 text-[10px] font-normal text-foreground-secondary">pcm</span>
            </p>
          </div>
          <div className="rounded-xl bg-surface-inset/50 p-2.5">
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
              Holding deposit
            </span>
            <p
              className="mt-0.5 text-[0.95rem] leading-none text-foreground"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              £220
            </p>
          </div>
        </div>
      </div>

      {/* Your details */}
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

      {/* Questions + info blocks in order */}
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

      {/* Bank details placeholder */}
      <div>
        <PreviewEyebrow icon={<Landmark className="h-3 w-3" />} label="Where to pay" />
        <div className="rounded-2xl border border-border bg-surface-card p-4 shadow-sm">
          <p className="text-[11px] text-foreground-muted">
            Bank details from Settings appear here once configured.
          </p>
        </div>
      </div>

      {/* CTA */}
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
              Submit application
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

  const displayType =
    item.question_type === "select"
      ? "Dropdown"
      : item.question_type === "checkbox"
      ? "Yes / no"
      : item.question_type === "textarea"
      ? "Long text"
      : item.question_type === "file_upload"
      ? "File upload"
      : null;

  return (
    <div className="rounded-2xl border border-border bg-surface-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-foreground flex-1">
          {item.question_text}
          {item.is_required && <span className="ml-1 text-red-500">*</span>}
        </p>
        {displayType && (
          <span className="text-[9px] text-foreground-muted uppercase tracking-wide">{displayType}</span>
        )}
      </div>
      {item.question_type === "textarea" ? (
        <div className="mt-2 h-14 rounded-xl border border-border bg-surface-inset/40" />
      ) : item.question_type === "checkbox" ? (
        <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-surface-inset/40 px-3 py-1.5 text-[11px] text-foreground-muted">
          <span className="inline-block h-3 w-3 rounded border border-border" />
          Yes
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
