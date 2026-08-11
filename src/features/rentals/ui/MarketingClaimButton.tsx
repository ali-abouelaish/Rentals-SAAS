"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  discardMarketingClaim,
  finalizeMarketingClaim,
  startMarketingClaim,
} from "@/features/rentals/actions/marketing-claims";
import {
  MAX_PROOF_FILES,
  PROOF_ACCEPT,
  proofFileError,
} from "@/features/rentals/domain/marketing-claims";

type Props = {
  rentalId: string;
  rentalCode: string;
};

/** `crypto.randomUUID` only exists in secure contexts, so it is undefined when
 *  the app is reached over plain http on a LAN address. Falling back keeps the
 *  upload working instead of throwing mid-submit. */
function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MarketingClaimButton({ rentalId, rentalCode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;

    // Reject unusable files here rather than after a doomed upload.
    const rejected = picked.map(proofFileError).find(Boolean);
    if (rejected) {
      setError(rejected);
      return;
    }

    setFiles((prev) => {
      if (prev.length + picked.length > MAX_PROOF_FILES) {
        setError(`You can attach at most ${MAX_PROOF_FILES} files.`);
        return [...prev, ...picked].slice(0, MAX_PROOF_FILES);
      }
      setError(null);
      return [...prev, ...picked];
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const reset = () => {
    setFiles([]);
    setNote("");
    setConfirming(false);
    setError(null);
    setProgress(null);
  };

  const goToConfirm = () => {
    if (files.length < 1) {
      setError("Attach at least one screenshot or PDF as proof.");
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const started = await startMarketingClaim({ rentalId, note: note.trim() });
      if (!started.ok || !started.claimId || !started.uploadPrefix) {
        setError(started.error ?? "Failed to submit claim.");
        return;
      }

      // Proof goes browser → Supabase Storage directly. Routing megabytes of
      // screenshots through the Server Action instead means the request has to
      // clear both Next's body limit and the reverse proxy's, and a rejection
      // there leaves the client with no result to apply.
      const supabase = createSupabaseBrowserClient();
      const uploaded: { path: string; name: string }[] = [];
      let firstUploadError: string | null = null;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress({ done: index, total: files.length });
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${started.uploadPrefix}/${randomId()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("rental_docs")
          .upload(path, file, { contentType: file.type || undefined });
        if (uploadError) {
          firstUploadError = firstUploadError ?? uploadError.message;
          continue;
        }
        uploaded.push({ path, name: file.name });
      }
      setProgress(null);

      if (uploaded.length === 0) {
        // Nothing landed — drop the empty claim so the agent isn't blocked by it.
        await discardMarketingClaim(started.claimId);
        setError(
          firstUploadError
            ? `Your proof couldn't be uploaded: ${firstUploadError}`
            : "Your proof couldn't be uploaded. Check your connection and try again."
        );
        return;
      }

      const finalized = await finalizeMarketingClaim({
        claimId: started.claimId,
        files: uploaded,
      });
      if (!finalized.ok) {
        setError(finalized.error ?? "Failed to submit claim.");
        return;
      }

      toast.success(
        uploaded.length < files.length
          ? `Marketing claim submitted with ${uploaded.length} of ${files.length} files — the rest failed to upload.`
          : "Marketing claim submitted. The team has been notified."
      );
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      // Anything thrown here used to escape as an unhandled rejection, which
      // blanks the whole page with "a client-side exception has occurred".
      console.error("[marketing-claim] submit failed", err);
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setProgress(null);
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) reset();
        setOpen(next);
      }}
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Megaphone className="h-3.5 w-3.5" />
        Claim as marketing
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {confirming ? "Confirm marketing claim" : `Claim marketing on ${rentalCode}`}
          </DialogTitle>
          <DialogDescription>
            {confirming
              ? `You're about to submit a marketing claim on rental ${rentalCode}. The assisting agent, admins, and any linked marketing agents will be notified, and they can approve or reject it.`
              : "Attach screenshots (or a PDF) showing your marketing activity for this client. The assisting agent, admins, and any linked marketing agents will be notified."}
          </DialogDescription>
        </DialogHeader>

        {confirming ? (
          <div className="space-y-3 rounded-xl border border-border bg-surface-inset p-4 text-sm">
            <div>
              <p className="text-xs font-medium text-foreground-muted">Proof attachments</p>
              <ul className="mt-1 space-y-1">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="truncate text-foreground">
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
            {note.trim() && (
              <div>
                <p className="text-xs font-medium text-foreground-muted">Note</p>
                <p className="text-foreground">{note.trim()}</p>
              </div>
            )}
            <p className="text-xs text-foreground-muted">
              Once submitted, the claim is marked as <strong>pending</strong> until an admin or
              the assisting agent reviews it.
            </p>
            {progress && (
              <p className="text-xs text-foreground-secondary">
                Uploading proof {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </p>
            )}
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground-secondary" htmlFor="claim-note">
                Note (optional)
              </label>
              <p className="text-xs text-foreground-muted">
                Max 500 characters — say where you marketed, e.g. &ldquo;Posted on SpareRoom
                and Facebook Marketplace&rdquo;.
              </p>
              <Input
                id="claim-note"
                placeholder="Add context — e.g. which platform you posted on"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground-secondary" htmlFor="claim-proof">
                Proof screenshots ({files.length}/{MAX_PROOF_FILES})
              </label>
              <p className="text-xs text-foreground-muted">
                Up to {MAX_PROOF_FILES} files, 10 MB each. JPG, PNG, WEBP, HEIC or PDF.
              </p>
              <input
                id="claim-proof"
                type="file"
                accept={PROOF_ACCEPT}
                multiple
                onChange={onFileChange}
                disabled={files.length >= MAX_PROOF_FILES}
                className="block w-full text-sm text-foreground-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-inset file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-border/40"
              />
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-md border border-border bg-surface-inset px-2 py-1 text-xs"
                    >
                      <span className="truncate pr-2 text-foreground">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-foreground-muted hover:text-foreground"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {error && <p className="text-xs text-error">{error}</p>}
            </div>
          </div>
        )}

        <DialogFooter>
          {confirming ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSubmit}
                loading={submitting}
                disabled={submitting}
              >
                Confirm and submit
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={goToConfirm}
                disabled={submitting || files.length < 1}
              >
                Submit claim
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
