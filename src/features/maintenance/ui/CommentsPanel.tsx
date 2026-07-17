"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageSquarePlus, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

// Matches the server-side CommentBodySchema in actions/comments.ts
const schema = z.object({
  body: z.string().trim().min(1, "Comment can't be empty").max(2000, "Max 2000 characters"),
});

type FormValues = z.infer<typeof schema>;

export interface PanelComment {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

interface CommentsPanelProps {
  comments: PanelComment[];
  /** Format/visibility hint rendered under the composer label. */
  hint: string;
  emptyText: string;
  /** Returns an error message on failure, or null/undefined on success. */
  onAdd: (body: string) => Promise<string | null | undefined>;
  onDelete: (commentId: string) => Promise<string | null | undefined>;
}

function formatCommentTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommentsPanel({ comments, hint, emptyText, onAdd, onDelete }: CommentsPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { body: "" } });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      const error = await onAdd(values.body);
      if (error) setServerError(error);
      else reset();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(comment: PanelComment) {
    if (!confirm("Delete this comment?")) return;
    setDeletingId(comment.id);
    try {
      const error = await onDelete(comment.id);
      if (error) setServerError(error);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-foreground-secondary">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="group flex items-start gap-3 rounded-xl bg-surface-inset p-3">
              <div className="p-2 rounded-lg bg-surface-card shrink-0">
                <UserRound size={14} className="text-foreground-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground">{c.author_name}</span>
                  <span className="text-[11px] text-foreground-muted">
                    {formatCommentTime(c.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground-secondary leading-relaxed">
                  {c.body}
                </p>
              </div>
              <button
                onClick={() => handleDelete(c)}
                disabled={deletingId === c.id}
                title="Delete this comment"
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-all disabled:opacity-50 shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        <div>
          <label htmlFor="comment-body" className="block text-sm font-medium text-foreground mb-0.5">
            Add a comment
          </label>
          <p className="text-[11px] text-foreground-muted mb-1.5">{hint}</p>
          <textarea
            id="comment-body"
            {...register("body")}
            rows={3}
            placeholder="Write an update…"
            className={cn(
              "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50 resize-none",
              errors.body ? "border-red-400" : "border-border"
            )}
          />
          {errors.body && <p className="text-xs text-red-600 mt-1">{errors.body.message}</p>}
          {serverError && <p className="text-xs text-red-600 mt-1">{serverError}</p>}
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" size="sm" loading={submitting}>
            <MessageSquarePlus size={14} />
            Post Comment
          </Button>
        </div>
      </form>
    </div>
  );
}
