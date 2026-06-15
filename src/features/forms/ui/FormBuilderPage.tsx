"use client";

import { useState, useTransition } from "react";
import {
  Copy,
  Check,
  Pencil,
  X,
  ToggleLeft,
  ToggleRight,
  Send,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuestionEditor } from "./QuestionEditor";
import { FormSendDialog } from "./FormSendDialog";
import { GoogleFormImportDialog } from "./GoogleFormImportDialog";
import { updateForm } from "../actions/forms";
import { formSchema, type FormValues } from "../domain/schemas";
import type { Form, FormQuestion } from "../domain/types";
import type { Client } from "@/features/clients/domain/types";

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

interface FormBuilderPageProps {
  form: Form;
  clients: Pick<Client, "id" | "full_name" | "email">[];
  appUrl: string;
}

export function FormBuilderPage({ form: initialForm, clients, appUrl }: FormBuilderPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initialForm);
  const [questions, setQuestions] = useState<FormQuestion[]>(initialForm.questions ?? []);
  const [editingHeader, setEditingHeader] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const editFormHook = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: form.name,
      description: form.description ?? "",
      is_active: form.is_active,
    },
  });

  const handleUpdateHeader = (values: FormValues) => {
    startTransition(async () => {
      try {
        await updateForm(form.id, values);
        setForm((prev) => ({
          ...prev,
          name: values.name,
          description: values.description ?? null,
          is_active: values.is_active,
        }));
        toast.success("Form updated");
        setEditingHeader(false);
      } catch {
        toast.error("Failed to update form");
      }
    });
  };

  const handleToggleActive = () => {
    startTransition(async () => {
      try {
        await updateForm(form.id, { is_active: !form.is_active });
        setForm((prev) => ({ ...prev, is_active: !prev.is_active }));
        toast.success(form.is_active ? "Form deactivated" : "Form activated");
      } catch {
        toast.error("Failed to update form");
      }
    });
  };

  const copyLink = () => {
    const url = `${appUrl}/f/${form.public_slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="space-y-5">
      {/* Back link */}
      <div className="flex items-center gap-2">
        <Link
          href="/forms"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All forms
        </Link>
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4">
        {editingHeader ? (
          <form
            onSubmit={editFormHook.handleSubmit(handleUpdateHeader)}
            className="space-y-3"
          >
            <FormField label="Form name *" error={editFormHook.formState.errors.name?.message}>
              <input {...editFormHook.register("name")} className={inputCls} autoFocus />
            </FormField>
            <FormField label="Description">
              <textarea
                {...editFormHook.register("description")}
                rows={2}
                className={`${inputCls} h-auto py-2`}
              />
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
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground tracking-tight">{form.name}</h1>
                <span
                  className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                    form.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {form.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {form.description && (
                <p className="text-sm text-foreground-secondary mt-1">{form.description}</p>
              )}
              <p className="text-xs text-foreground-muted mt-1">/f/{form.public_slug}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingHeader(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy link
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSendOpen(true)}>
                <Send className="h-3.5 w-3.5 mr-1" />
                Send form
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Import
              </Button>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={isPending}
                title={form.is_active ? "Deactivate form" : "Activate form"}
              >
                {form.is_active ? (
                  <ToggleRight className="h-5 w-5 text-green-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-foreground-muted" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Question editor */}
      <div className="rounded-xl border border-border bg-surface-card p-5">
        <QuestionEditor
          formId={form.id}
          questions={questions}
          onQuestionsChange={(q) => {
            setQuestions(q);
            router.refresh();
          }}
        />
      </div>

      <FormSendDialog
        formId={form.id}
        formName={form.name}
        clients={clients}
        open={sendOpen}
        onOpenChange={setSendOpen}
      />

      <GoogleFormImportDialog
        formId={form.id}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(newQuestions) => {
          setQuestions((prev) => [...prev, ...newQuestions]);
          router.refresh();
        }}
      />
    </div>
  );
}
