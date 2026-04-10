"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, X } from "lucide-react";
import { updateInvoiceDraft } from "@/features/invoices/actions/invoices";

type Props = {
  invoice: {
    id: string;
    billing_profile_id: string;
    landlord_id: string;
    issue_date: string;
    payment_terms_days: number;
    notes: string | null;
  };
  billingProfiles: { id: string; name: string }[];
  landlords: { id: string; name: string }[];
};

export function InvoiceEditSection({ invoice, billingProfiles, landlords }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        {open ? (
          <>
            <X className="h-4 w-4 mr-1.5" /> Cancel
          </>
        ) : (
          <>
            <Pencil className="h-4 w-4 mr-1.5" /> Edit invoice
          </>
        )}
      </Button>

      {open && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <form action={updateInvoiceDraft} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <div>
                <label className="text-xs text-foreground-secondary">Billing profile</label>
                <select
                  name="billing_profile_id"
                  defaultValue={invoice.billing_profile_id}
                  className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm"
                >
                  {billingProfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-foreground-secondary">Landlord</label>
                <select
                  name="landlord_id"
                  defaultValue={invoice.landlord_id}
                  className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm"
                >
                  {landlords.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-foreground-secondary">Issue date</label>
                <Input name="issue_date" type="date" defaultValue={invoice.issue_date} />
              </div>
              <div>
                <label className="text-xs text-foreground-secondary">Payment terms (days)</label>
                <Input
                  name="payment_terms_days"
                  type="number"
                  defaultValue={invoice.payment_terms_days}
                  placeholder="7"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-foreground-secondary">Notes</label>
                <Textarea name="notes" defaultValue={invoice.notes ?? ""} placeholder="Notes" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" variant="secondary">Save changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
