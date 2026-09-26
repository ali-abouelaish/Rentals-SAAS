"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LifeBuoy, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { createSupportTicket } from "../actions/tickets";
import { readLastPage } from "../lib/lastPage";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  createTicketSchema,
  type CreateTicketInput,
} from "../domain/types";
import { AttachmentPicker } from "./AttachmentPicker";
import { Field } from "./Field";

const SELECT_CLASS =
  "flex h-11 w-full rounded-lg border bg-surface-card px-3 text-base text-foreground md:h-10 sm:text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20";

export function NewTicketDialog({ triggerLabel = "New ticket" }: { triggerLabel?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { subject: "", category: "bug", priority: "normal", body: "" },
  });

  function resetAll() {
    reset();
    setFiles([]);
    setFileError(null);
    setServerError(null);
  }

  async function onSubmit(values: CreateTicketInput) {
    setServerError(null);
    const fd = new FormData();
    fd.set("subject", values.subject);
    fd.set("category", values.category);
    fd.set("priority", values.priority);
    fd.set("body", values.body);
    // Silent context — helps us reproduce the problem. Never shown as a field.
    // The page they came FROM, not /helpdesk (see lib/lastPage.ts).
    const lastPage = readLastPage();
    if (lastPage) fd.set("page_url", lastPage);
    fd.set("user_agent", navigator.userAgent);
    for (const f of files) fd.append("files", f);

    const result = await createSupportTicket(fd);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (result.warning) toast.warning(result.warning);
    toast.success("Ticket sent — we'll email you when we reply");
    setOpen(false);
    resetAll();
    if (result.id) router.push(`/helpdesk/${result.id}`);
    else router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetAll();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          <LifeBuoy size={15} aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact Harbor Ops Support</DialogTitle>
          <DialogDescription>
            Tell us what's going on. You'll get an email when we reply, and you can follow up on the ticket page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field
            id="ticket-subject"
            label="Subject"
            hint="A one-line summary. 5–150 characters."
            error={errors.subject?.message}
          >
            <Input
              id="ticket-subject"
              {...register("subject")}
              placeholder="e.g. Rent reminders didn't send this morning"
              aria-invalid={!!errors.subject}
              className={cn(errors.subject && "border-red-400")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="ticket-category"
              label="Category"
              hint="Pick the closest match."
              tooltip="Helps us route your ticket to the right person — billing questions and bugs are handled by different people."
              error={errors.category?.message}
            >
              <select id="ticket-category" {...register("category")} className={cn(SELECT_CLASS, "border-border")}>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="ticket-priority"
              label="Priority"
              hint="How badly is this affecting you?"
              tooltip="Use Urgent only when your agency can't operate (e.g. nobody can log in). Urgent tickets are flagged in our inbox and answered first."
              error={errors.priority?.message}
            >
              <select id="ticket-priority" {...register("priority")} className={cn(SELECT_CLASS, "border-border")}>
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            id="ticket-body"
            label="Description"
            hint="What happened, what you expected, and the steps to reproduce it. 20–5000 characters."
            error={errors.body?.message}
          >
            <Textarea
              id="ticket-body"
              rows={6}
              {...register("body")}
              placeholder="When I open Rent Collection and click…"
              aria-invalid={!!errors.body}
              className={cn(errors.body && "border-red-400")}
            />
          </Field>

          <AttachmentPicker
            id="ticket-files"
            files={files}
            onChange={setFiles}
            error={fileError}
            onError={setFileError}
            disabled={isSubmitting}
          />

          <p className="text-[11px] text-foreground-muted">
            We automatically include the last page you visited before opening Contact Support, and your browser version, to help us reproduce the issue.
          </p>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" loading={isSubmitting}>
              <Send size={14} aria-hidden />
              Send ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
