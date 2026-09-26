"use client";

import { useRef } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, validateAttachment } from "../domain/types";

interface AttachmentPickerProps {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
  /** Validation message to render inline below the field. */
  error: string | null;
  onError: (message: string | null) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Files aren't registered with react-hook-form (a zodResolver key with no
 * registered input makes handleSubmit fail silently) — the parent holds them in
 * state and this component validates each one on the way in, with the same
 * rules the server action re-checks.
 */
export function AttachmentPicker({ id, files, onChange, error, onError, disabled }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handlePick(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const next = [...files, ...incoming];
    if (next.length > MAX_ATTACHMENTS) {
      onError(`Attach at most ${MAX_ATTACHMENTS} files`);
    } else {
      const bad = incoming.map(validateAttachment).find(Boolean) ?? null;
      if (bad) onError(bad);
      else {
        onError(null);
        onChange(next);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-0.5">
        Attachments <span className="font-normal text-foreground-muted">(optional)</span>
      </label>
      <p className="text-[11px] text-foreground-muted mb-1.5">
        Up to {MAX_ATTACHMENTS} files, 10 MB each — PNG, JPG, WEBP, GIF, PDF, TXT or CSV.
      </p>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handlePick(e.target.files)}
      />
      <Tooltip content="A screenshot of the problem (including any error message) is usually the fastest way for us to fix it.">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || files.length >= MAX_ATTACHMENTS}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip size={14} />
          Add files
        </Button>
      </Tooltip>

      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-lg bg-surface-inset px-2.5 py-1.5 text-xs text-foreground-secondary"
            >
              <FileText size={13} className="shrink-0 text-foreground-muted" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-foreground-muted">{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => {
                  onError(null);
                  onChange(files.filter((_, idx) => idx !== i));
                }}
                disabled={disabled}
                aria-label={`Remove ${f.name}`}
                title="Remove this file"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 md:h-7 md:w-7 disabled:opacity-50"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
