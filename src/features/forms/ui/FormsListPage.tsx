"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, ToggleLeft, ToggleRight, ListChecks } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createForm, updateForm, deleteForm } from "../actions/forms";
import { formSchema, type FormValues } from "../domain/schemas";
import type { Form } from "../domain/types";

const inputCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

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

interface FormsListPageProps {
  initialForms: Form[];
}

export function FormsListPage({ initialForms }: FormsListPageProps) {
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>(initialForms);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const createFormHook = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { is_active: true },
  });

  const handleCreate = (values: FormValues) => {
    startTransition(async () => {
      try {
        const data = await createForm(values);
        toast.success("Form created");
        createFormHook.reset({ is_active: true });
        setCreateOpen(false);
        router.push(`/forms/${data.id}`);
      } catch {
        toast.error("Failed to create form");
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

  const handleDelete = (form: Form) => {
    startTransition(async () => {
      try {
        await deleteForm(form.id);
        setForms((prev) => prev.filter((f) => f.id !== form.id));
        setDeletingId(null);
        toast.success("Form deleted");
      } catch {
        toast.error("Failed to delete form");
      }
    });
  };

  return (
    <div className="space-y-5">
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

      {forms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <ListChecks className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No forms yet</p>
          <p className="text-xs text-foreground-secondary max-w-xs mx-auto">
            Create your first form to start collecting responses from clients and tenants.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {forms.map((form) => (
            <div
              key={form.id}
              className="rounded-xl border border-border bg-surface-card p-4 space-y-3 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{form.name}</p>
                  {form.description && (
                    <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">
                      {form.description}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 text-[10px] font-medium rounded-full px-2 py-0.5 ${
                    form.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {form.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <p className="text-[11px] text-foreground-muted">/f/{form.public_slug}</p>

              <div className="flex items-center gap-2 pt-1 mt-auto">
                <Link
                  href={`/forms/${form.id}`}
                  className="flex-1 inline-flex items-center justify-center h-8 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-surface-inset transition-colors"
                >
                  Builder
                </Link>
                <Link
                  href={`/forms/${form.id}/responses`}
                  className="flex-1 inline-flex items-center justify-center h-8 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-surface-inset transition-colors"
                >
                  Responses
                </Link>
                <button
                  type="button"
                  onClick={() => handleToggleActive(form)}
                  disabled={isPending}
                  title={form.is_active ? "Deactivate" : "Activate"}
                  className="flex h-8 w-8 items-center justify-center"
                >
                  {form.is_active ? (
                    <ToggleRight className="h-5 w-5 text-green-600" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-foreground-muted" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(form.id)}
                  disabled={isPending}
                  title="Delete form"
                  className="flex h-8 w-8 items-center justify-center"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Form</DialogTitle>
          </DialogHeader>
          <form onSubmit={createFormHook.handleSubmit(handleCreate)} className="space-y-4 mt-2">
            <FormField label="Form name *" error={createFormHook.formState.errors.name?.message}>
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

      {/* Delete confirm dialog */}
      {deletingId && (
        <Dialog open onOpenChange={() => setDeletingId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete form?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-foreground-secondary mt-1">
              This will permanently delete the form and all its responses. This action cannot be
              undone.
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
    </div>
  );
}
