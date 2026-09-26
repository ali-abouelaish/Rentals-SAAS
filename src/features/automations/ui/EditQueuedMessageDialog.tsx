"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Save } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ScheduledMessageRow } from "../domain/types";
import { updateQueuedMessage } from "../actions/reminders";

const inputCls =
  "w-full rounded-xl border bg-surface-card px-3 py-2.5 md:py-2 text-base md:text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50";
const hintCls = "text-[11px] text-foreground-muted mt-1";
const errCls = "text-xs text-red-600 mt-1";

function fieldError(border: boolean) {
  return cn(inputCls, border ? "border-red-400" : "border-border");
}

const formSchema = z.object({
  subject: z.string().trim().max(200, "Max 200 characters").optional(),
  body: z.string().trim().min(1, "Message body is required").max(5000, "Max 5000 characters"),
  sendAtLocal: z.string().min(1, "Pick a date and time"),
});

type FormValues = z.infer<typeof formSchema>;

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Edit a queued/snoozed message's subject, body, or send time before it goes out. */
export function EditQueuedMessageDialog({ row }: { row: ScheduledMessageRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: row.subject ?? "",
      body: row.body,
      sendAtLocal: toLocalInputValue(row.send_at),
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const res = await updateQueuedMessage({
        id: row.id,
        subject: values.subject || null,
        body: values.body,
        sendAtISO: new Date(values.sendAtLocal).toISOString(),
      });
      if (res.ok) {
        toast.success("Message updated");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="Edit the message or reschedule it before it sends"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit queued message</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {row.channel === "email" ? "Subject" : "Title"}
            </label>
            <input {...register("subject")} className={fieldError(!!errors.subject)} />
            <p className={hintCls}>Max 200 characters.</p>
            {errors.subject && <p className={errCls}>{errors.subject.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
            <textarea {...register("body")} rows={6} className={fieldError(!!errors.body)} />
            <p className={hintCls}>
              This is the final text as it will send — placeholders were already filled in when
              it was queued. Max 5000 characters.
            </p>
            {errors.body && <p className={errCls}>{errors.body.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Send at</label>
            <input
              type="datetime-local"
              {...register("sendAtLocal")}
              className={fieldError(!!errors.sendAtLocal)}
            />
            <p className={hintCls}>
              Emails outside the agency send window are held until it opens.
            </p>
            {errors.sendAtLocal && <p className={errCls}>{errors.sendAtLocal.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              <Save className="h-3.5 w-3.5" />
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
