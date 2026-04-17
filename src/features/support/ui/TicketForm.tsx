"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2, Trash2, Video, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type UploadedAttachment = {
  id: string;
  kind: "image" | "video" | "audio";
  previewUrl: string;
  name: string;
};

interface Props {
  conversationId: string;
  apiPath: (path: string) => string;
  onClose: () => void;
  onSubmitted: (reference: string) => void;
}

const MAX_BYTES = 50 * 1024 * 1024;

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
};

export function TicketForm({ conversationId, apiPath, onClose, onSubmitted }: Props) {
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hasImage = attachments.some((a) => a.kind === "image");
  const canSubmit = description.trim().length > 0 && hasImage && !submitting && !uploading;

  async function uploadOne(file: File) {
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is too large (max 50MB).`);
      return;
    }
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(
        apiPath(`/api/support/conversations/${conversationId}/uploads`),
        { method: "POST", body: form }
      );
      if (!res.ok) {
        const msg = res.status === 415
          ? "That file type isn't supported."
          : res.status === 413
          ? "That file is too large."
          : "Upload failed.";
        setError(msg);
        return;
      }
      const body = (await res.json()) as {
        attachmentId: string;
        kind: "image" | "video" | "audio";
        signedUrl: string | null;
      };
      const previewUrl = body.signedUrl ?? URL.createObjectURL(file);
      setAttachments((prev) => [
        ...prev,
        {
          id: body.attachmentId,
          kind: body.kind,
          previewUrl,
          name: file.name,
        },
      ]);
    } catch (err) {
      console.error(err);
      setError("Upload failed — please try again.");
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    for (const file of Array.from(files)) {
      await uploadOne(file);
    }
    setUploading(false);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/support/tickets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          description: description.trim(),
          attachmentIds: attachments.map((a) => a.id),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          payload.error === "image_required"
            ? "Please attach at least one photo."
            : "Couldn't submit your request. Please try again."
        );
        return;
      }
      const body = (await res.json()) as { reference: string };
      onSubmitted(body.reference);
    } catch (err) {
      console.error(err);
      setError("Couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-title"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
          className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface-card shadow-[0_40px_80px_-20px_rgba(15,23,42,0.55)] sm:rounded-3xl"
        >
          {/* Header — serif emotional moment */}
          <div
            className="relative border-b border-border px-6 pb-5 pt-6"
            style={{
              backgroundImage:
                "radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--brand-primary) 8%, transparent), transparent 60%)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-foreground-secondary transition hover:bg-surface-inset hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
              New request
            </p>
            <h2
              id="ticket-title"
              className="mt-1 text-[1.65rem] leading-tight tracking-[-0.015em] text-foreground"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              Tell us what's wrong
            </h2>
            <p className="mt-1.5 text-sm text-foreground-secondary">
              A short description plus at least one photo helps your landlord act quickly.
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {/* Description */}
            <div>
              <label
                htmlFor="ticket-description"
                className="mb-2 block text-[13px] font-medium text-foreground"
              >
                What's happening?
              </label>
              <textarea
                id="ticket-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="e.g. The kitchen tap drips even when closed. Started yesterday evening…"
                className="w-full resize-none rounded-2xl border border-border bg-surface-card px-4 py-3 text-[14.5px] leading-relaxed text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted">
                  Plain language is fine — we'll translate for the handyman.
                </p>
                <p className="text-[11px] tabular-nums text-foreground-muted">
                  {description.trim().length}
                </p>
              </div>
            </div>

            {/* Media upload */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label className="block text-[13px] font-medium text-foreground">
                  Photos <span className="text-red-600">*</span>
                </label>
                <p className="text-[11px] text-foreground-muted">
                  at least one photo · 50MB max
                </p>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void handleFiles(e.dataTransfer.files);
                }}
                className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200 ${
                  dragOver
                    ? "scale-[1.01] border-brand bg-brand-subtle/60"
                    : "border-border bg-surface-inset/40"
                } ${hasImage ? "border-solid border-emerald-200 bg-emerald-50/60" : ""}`}
              >
                {/* Decorative dot-grid */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, color-mix(in oklab, var(--border-default) 50%, transparent) 1px, transparent 1px)",
                    backgroundSize: "14px 14px",
                    maskImage:
                      "radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 75%)",
                  }}
                />

                <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-surface-card shadow-sm">
                  {hasImage ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Camera className="h-5 w-5 text-foreground-secondary" />
                  )}
                </div>
                <div className="relative">
                  <p className="text-[13.5px] font-medium text-foreground">
                    {dragOver
                      ? "Drop to upload"
                      : hasImage
                        ? "Got it — add more if helpful"
                        : "Drag photos or a video here"}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-foreground-secondary">
                    or tap below to choose from your device
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="relative inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card px-4 py-1.5 text-[12px] font-medium text-foreground shadow-sm transition hover:border-brand/40 hover:bg-brand-subtle hover:text-brand"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-3.5 w-3.5" />
                      Choose files
                    </>
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
              </div>

              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.ul
                    key="attachments"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 grid grid-cols-3 gap-2"
                  >
                    {attachments.map((a) => (
                      <motion.li
                        key={a.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-surface-inset ring-1 ring-border"
                      >
                        {a.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.previewUrl}
                            alt={a.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-foreground-secondary">
                            <Video className="h-6 w-6" />
                            <span className="px-2 text-center text-[10px] text-foreground-muted">
                              {a.name}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          aria-label={`Remove ${a.name}`}
                          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white opacity-0 shadow-md transition hover:bg-red-700 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700"
              >
                {error}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-card px-5 py-4">
            <p className="hidden text-[11px] text-foreground-muted sm:block">
              {hasImage && description.trim().length > 0
                ? "Ready to send — your landlord will get this instantly."
                : "Add a photo and a description to continue."}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border bg-surface-card px-4 py-2 text-[13px] font-medium text-foreground-secondary transition hover:bg-surface-inset hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-medium text-brand-fg shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-md"
                style={{ background: "var(--brand-primary)" }}
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Send request
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
