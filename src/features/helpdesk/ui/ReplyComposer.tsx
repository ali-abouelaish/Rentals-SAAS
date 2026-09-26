"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { addAgencyMessage } from "../actions/tickets";
import { addPlatformMessage } from "../actions/admin";
import {
  STATUS_LABELS_PLATFORM,
  TICKET_STATUSES,
  ticketMessageSchema,
  type TicketStatus,
} from "../domain/types";
import { AttachmentPicker } from "./AttachmentPicker";

type FormValues = z.infer<typeof ticketMessageSchema>;

const SELECT_CLASS =
  "flex h-11 w-full rounded-lg border border-border bg-surface-card px-3 text-base text-foreground md:h-9 sm:text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20";

interface ReplyComposerProps {
  ticketId: string;
  side: "agency" | "platform";
  /** Current status — platform side offers to move it in the same step. */
  currentStatus?: TicketStatus;
}

export function ReplyComposer({ ticketId, side, currentStatus }: ReplyComposerProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [internal, setInternal] = useState(false);
  // Replying usually means the ball is now in the agency's court.
  const [nextStatus, setNextStatus] = useState<TicketStatus>(
    currentStatus && currentStatus !== "open" && currentStatus !== "in_progress" ? currentStatus : "waiting_on_agency"
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(ticketMessageSchema), defaultValues: { body: "" } });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const fd = new FormData();
    fd.set("body", values.body);
    for (const f of files) fd.append("files", f);

    let result;
    if (side === "platform") {
      fd.set("internal", internal ? "true" : "false");
      if (!internal) fd.set("status", nextStatus);
      result = await addPlatformMessage(ticketId, fd);
    } else {
      result = await addAgencyMessage(ticketId, fd);
    }

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (result.warning) toast.warning(result.warning);
    toast.success(internal ? "Internal note added" : "Reply sent");
    reset();
    setFiles([]);
    setFileError(null);
    router.refresh();
  }

  const composerId = `reply-body-${ticketId}`;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={cn(
        "space-y-3 rounded-xl border p-4",
        internal ? "border-amber-300 bg-amber-50/60 dark:bg-amber-500/5" : "border-border bg-surface-card"
      )}
    >
      {side === "platform" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-surface-inset p-0.5" role="radiogroup" aria-label="Message type">
            <button
              type="button"
              role="radio"
              aria-checked={!internal}
              onClick={() => setInternal(false)}
              className={cn(
                "h-11 rounded-md px-3 text-xs font-medium md:h-8",
                !internal ? "bg-surface-card text-foreground shadow-sm" : "text-foreground-secondary"
              )}
            >
              Reply to agency
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={internal}
              onClick={() => setInternal(true)}
              className={cn(
                "inline-flex h-11 items-center gap-1 rounded-md px-3 text-xs font-medium md:h-8",
                internal ? "bg-amber-200 text-amber-900 shadow-sm" : "text-foreground-secondary"
              )}
            >
              <Lock size={12} /> Internal note
            </button>
          </div>
          <Tooltip content="Internal notes are only visible to super admins. Use them for investigation notes, links to logs, or hand-offs — the agency is never emailed and the ticket's status and activity time don't change.">
            <button type="button" aria-label="About internal notes" className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground-muted hover:text-foreground">
              <Info size={14} />
            </button>
          </Tooltip>
        </div>
      )}

      <div>
        <label htmlFor={composerId} className="block text-sm font-medium text-foreground mb-0.5">
          {side === "agency" ? "Reply or add more detail" : internal ? "Internal note" : "Reply"}
        </label>
        <p className="text-[11px] text-foreground-muted mb-1.5">
          {side === "agency"
            ? "Harbor Ops Support is emailed straight away. Max 5000 characters."
            : internal
              ? "Only super admins will see this. Max 5000 characters."
              : "The agency user who raised the ticket is emailed this reply. Max 5000 characters."}
        </p>
        <Textarea
          id={composerId}
          rows={4}
          {...register("body")}
          placeholder={side === "agency" ? "Write your reply…" : internal ? "Investigation notes…" : "Hi, thanks for getting in touch…"}
          aria-invalid={!!errors.body}
          className={cn(errors.body && "border-red-400")}
        />
        {errors.body && <p className="text-xs text-red-600 mt-1">{errors.body.message}</p>}
      </div>

      <AttachmentPicker
        id={`reply-files-${ticketId}`}
        files={files}
        onChange={setFiles}
        error={fileError}
        onError={setFileError}
        disabled={isSubmitting}
      />

      {side === "platform" && !internal && (
        <div className="max-w-xs">
          <div className="mb-0.5 flex items-center gap-1">
            <label htmlFor={`reply-status-${ticketId}`} className="block text-sm font-medium text-foreground">
              Set status to
            </label>
            <Tooltip content="“Waiting on agency” tells them the next move is theirs; it flips back to Open automatically when they reply. Pick Resolved when your reply is the fix.">
              <button type="button" aria-label="About status" className="inline-flex h-6 w-6 items-center justify-center rounded text-foreground-muted hover:text-foreground">
                <Info size={13} />
              </button>
            </Tooltip>
          </div>
          <p className="text-[11px] text-foreground-muted mb-1.5">Applied together with this reply.</p>
          <select
            id={`reply-status-${ticketId}`}
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as TicketStatus)}
            className={SELECT_CLASS}
          >
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS_PLATFORM[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={isSubmitting}>
          {internal ? <Lock size={14} aria-hidden /> : <Send size={14} aria-hidden />}
          {internal ? "Add internal note" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
