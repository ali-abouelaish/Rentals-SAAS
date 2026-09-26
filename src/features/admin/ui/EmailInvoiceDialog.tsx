"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";

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
import { Tooltip } from "@/components/ui/tooltip";
import { emailInvoiceAction } from "../actions/billing";

/**
 * Send an invoice to the agency.
 *
 * A dialog rather than a one-click send, because an email cannot be unsent and
 * the address it goes to is worth seeing before it leaves. The billing contact
 * is pre-filled; overriding it is for the case where an agency has asked for a
 * particular month to go to their accountant.
 */
export function EmailInvoiceDialog({
  invoiceId,
  agencyName,
  invoiceNumber,
  periodLabel,
  defaultEmail,
  alreadySentTo,
  sentAt,
}: {
  invoiceId: string;
  agencyName: string;
  invoiceNumber: string | null;
  periodLabel: string;
  defaultEmail: string | null;
  alreadySentTo: string | null;
  sentAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resend = Boolean(sentAt);

  const handleSend = () => {
    const value = email.trim();
    if (!value) {
      setError("Enter the address this should go to");
      return;
    }
    // Deliberately loose — the server action validates properly with Zod. This
    // only catches the obvious typo before a round trip.
    if (!value.includes("@") || !value.includes(".")) {
      setError("That doesn't look like an email address");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await emailInvoiceAction({ invoiceId, to: value });
      if ("error" in result) {
        toast.error("Could not send", { description: result.error });
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Tooltip
        content={
          resend
            ? `Already sent to ${alreadySentTo} on ${formatDate(sentAt)}. Sending again will deliver another copy.`
            : "Emails the agency's billing contact with the PDF attached."
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Mail className="h-3.5 w-3.5 mr-1.5" />
          {resend ? "Resend" : "Email"}
        </Button>
      </Tooltip>

      {open && (
        <Dialog open onOpenChange={(next) => !next && setOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Email invoice {invoiceNumber ?? ""} to {agencyName}
              </DialogTitle>
              <DialogDescription>
                Sends the {periodLabel} invoice with the PDF attached, from Harbor
                Ops — not from the agency&apos;s own mailbox.
              </DialogDescription>
            </DialogHeader>

            {resend && (
              <p className="rounded-lg bg-amber-50 border border-amber-300 p-2.5 text-[11px] text-amber-900">
                This was already sent to {alreadySentTo} on {formatDate(sentAt)}.
                Sending again delivers a second copy.
              </p>
            )}

            <div className="py-1">
              <label htmlFor="invoiceEmailTo" className="block text-xs font-medium text-foreground">
                Send to
              </label>
              <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
                {defaultEmail
                  ? "Pre-filled from the agency's billing contact. Change it to send this one elsewhere."
                  : "This agency has no billing email set — type the address, or add one under their Billing info."}
              </p>
              <Input
                id="invoiceEmailTo"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
              />
              {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={isPending}
                onClick={handleSend}
              >
                {resend ? "Send again" : "Send invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
