"use client";

import { useState, useTransition } from "react";
import { Plus, Copy, ToggleLeft, ToggleRight, Trash2, ExternalLink, Check } from "lucide-react";
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
  const [selectedForm, setSelectedForm] = useState<BookingForm | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { is_active: true },
  });

  const handleCreate = (values: BookingFormValues) => {
    startTransition(async () => {
      try {
        await createBookingForm(values);
        toast.success("Form created");
        reset();
        setCreateOpen(false);
        router.refresh();
      } catch {
        toast.error("Failed to create form");
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
        if (selectedForm?.id === form.id) setSelectedForm(null);
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
    const updated = { ...selectedForm, questions };
    setSelectedForm(updated);
    setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    // Refresh so question IDs from DB are synced
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Booking Forms</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Build public-facing forms for rental applicants
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New form
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Form list */}
        <div className="space-y-2">
          {forms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-foreground-muted">No forms yet. Create one to get started.</p>
            </div>
          ) : (
            forms.map((form) => (
              <button
                key={form.id}
                type="button"
                onClick={() => setSelectedForm(form)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  selectedForm?.id === form.id
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

        {/* Question editor panel */}
        {selectedForm ? (
          <div className="rounded-xl border border-border bg-surface-card p-5 space-y-5">
            {/* Form header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">{selectedForm.name}</h2>
                {selectedForm.description && (
                  <p className="text-sm text-foreground-secondary mt-0.5">{selectedForm.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                  Preview
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

            <div className="border-t border-border" />

            <QuestionEditor
              formId={selectedForm.id}
              questions={selectedForm.questions ?? []}
              onQuestionsChange={handleQuestionsChange}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-foreground-muted">Select a form to edit its questions</p>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Booking Form</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4 mt-2">
            <FormField label="Form name *" error={errors.name?.message}>
              <input {...register("name")} className={inputCls} placeholder="e.g. Standard Rental Application" autoFocus />
            </FormField>
            <FormField label="Description">
              <textarea
                {...register("description")}
                rows={2}
                className={`${inputCls} h-auto py-2`}
                placeholder="Brief description shown to applicants…"
              />
            </FormField>
            {portfolios.length > 0 && (
              <FormField label="Portfolio (optional)">
                <select {...register("portfolio_id")} className={selectCls}>
                  <option value="">All portfolios</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </FormField>
            )}
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
