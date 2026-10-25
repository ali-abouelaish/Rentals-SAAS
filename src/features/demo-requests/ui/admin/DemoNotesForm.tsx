"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveDemoRequestNotes } from "../../actions/admin";
import { demoNotesSchema, NOTES_MAX, type DemoNotesValues } from "../../domain/schemas";

/** The team's private notes on a request: who's following up, when the walkthrough is, how it went. */
export function DemoNotesForm({ requestId, notes }: { requestId: string; notes: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<DemoNotesValues>({
    resolver: zodResolver(demoNotesSchema),
    defaultValues: { notes: notes ?? "" },
  });
  const error = form.formState.errors.notes?.message;

  const onSubmit = (values: DemoNotesValues) =>
    startTransition(async () => {
      const result = await saveDemoRequestNotes(requestId, values);
      if (!result.ok) {
        form.setError("notes", { message: result.error });
        return;
      }
      toast.success("Notes saved");
      form.reset(values);
      router.refresh();
    });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-2">
      <label htmlFor={`demo-notes-${requestId}`} className="block text-sm font-medium text-foreground">
        Notes
      </label>
      <p id={`demo-notes-${requestId}-hint`} className="text-[11px] text-foreground-muted">
        Only super admins see these. Up to {NOTES_MAX.toLocaleString("en-GB")} characters.
      </p>
      <Textarea
        id={`demo-notes-${requestId}`}
        rows={5}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `demo-notes-${requestId}-hint demo-notes-${requestId}-error` : `demo-notes-${requestId}-hint`}
        {...form.register("notes")}
      />
      {error && (
        <p id={`demo-notes-${requestId}-error`} className="text-xs text-error">
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" size="sm" loading={isPending} disabled={!form.formState.isDirty} className="w-full">
        Save notes
      </Button>
    </form>
  );
}
