"use client";

import { useState, useTransition, type ChangeEvent } from "react";
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
import { claimRentalAsMarketing } from "@/features/rentals/actions/marketing-claims";

type Props = {
  rentalId: string;
  rentalCode: string;
};

const MAX_FILES = 8;

export function MarketingClaimButton({ rentalId, rentalCode }: Props) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;
    setFiles((prev) => {
      const combined = [...prev, ...picked];
      return combined.slice(0, MAX_FILES);
    });
    event.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setFiles([]);
    setNote("");
    setConfirming(false);
  };

  const goToConfirm = () => {
    if (files.length < 1) {
      toast.error("Attach at least one screenshot or PDF as proof.");
      return;
    }
    setConfirming(true);
  };

  const handleSubmit = () => {
    const formData = new FormData();
    formData.set("rental_id", rentalId);
    if (note.trim()) formData.set("note", note.trim());
    for (const file of files) formData.append("proof", file);

    startTransition(async () => {
      const result = await claimRentalAsMarketing(formData);
      if (result.ok) {
        toast.success("Marketing claim submitted. The team has been notified.");
        reset();
        setOpen(false);
      } else if (result.partial) {
        toast.error(
          result.error
            ? `Claim saved but proof upload failed: ${result.error}`
            : "Claim saved but proof upload failed."
        );
      } else {
        toast.error(result.error ?? "Failed to submit claim.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
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
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground-secondary" htmlFor="claim-note">
                Note (optional)
              </label>
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
                Proof screenshots ({files.length}/{MAX_FILES})
              </label>
              <input
                id="claim-proof"
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={onFileChange}
                disabled={files.length >= MAX_FILES}
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
              <p className="text-xs text-foreground-muted">
                Up to {MAX_FILES} files, 10 MB each. Images or PDFs.
              </p>
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
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSubmit}
                loading={isPending}
                disabled={isPending}
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
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={goToConfirm}
                disabled={isPending || files.length < 1}
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
