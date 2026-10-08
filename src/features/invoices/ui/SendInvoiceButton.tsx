"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { SendInvoiceDialog } from "./SendInvoiceDialog";

export function SendInvoiceButton({
  invoiceId,
  invoiceNumber,
  isResend,
}: {
  invoiceId: string;
  invoiceNumber: string;
  isResend: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip
        content={
          isResend
            ? "Email the landlord another copy — useful if they lost it or the invoice was edited."
            : "Review the email, then send it to the landlord with the PDF attached."
        }
      >
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          <Send className="h-4 w-4" />
          {isResend ? "Resend invoice" : "Send invoice"}
        </Button>
      </Tooltip>
      <SendInvoiceDialog
        invoiceId={invoiceId}
        invoiceNumber={invoiceNumber}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
