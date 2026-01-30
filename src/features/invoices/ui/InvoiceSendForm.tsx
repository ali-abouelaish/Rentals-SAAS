"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { sendInvoice } from "@/features/invoices/actions/invoices";

export function InvoiceSendForm({
  invoiceId,
  defaultSubject,
  defaultBody
}: {
  invoiceId: string;
  defaultSubject: string;
  defaultBody: string;
}) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  return (
    <form action={sendInvoice} className="space-y-3 rounded-2xl border border-muted p-4">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <Input
        name="subject"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        placeholder="Email subject"
      />
      <Textarea
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Email body"
      />
      <Button type="submit" variant="secondary">
        Send invoice
      </Button>
    </form>
  );
}
