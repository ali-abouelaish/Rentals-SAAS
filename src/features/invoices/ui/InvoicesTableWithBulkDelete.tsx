"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { DataTable } from "@/components/shared/DataTable";
import { InvoiceStatusBadge } from "@/features/invoices/ui/InvoiceStatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { bulkDeleteInvoicesAction } from "@/features/invoices/actions/invoices";
import { toast } from "sonner";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  landlord_id: string;
  total: number;
  due_date: string;
  status: string;
  created_by_user_id: string;
  pdf_storage_path: string | null;
  landlords?: { name: string | null } | null;
};

export function InvoicesTableWithBulkDelete({
  invoices,
  isAdmin,
  currentUserId,
  onViewPdf
}: {
  invoices: InvoiceRow[];
  isAdmin: boolean;
  currentUserId: string;
  onViewPdf: (invoiceId: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [state, action] = useFormState(bulkDeleteInvoicesAction, {});

  const selectableIds = useMemo(
    () =>
      invoices
        .filter(
          (invoice) =>
            invoice.status === "draft" &&
            (isAdmin || invoice.created_by_user_id === currentUserId)
        )
        .map((invoice) => invoice.id),
    [invoices, isAdmin, currentUserId]
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Invoices deleted.");
      setSelected([]);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.ok, state?.error]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelected(selectableIds);
  };

  const clearAll = () => {
    setSelected([]);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Delete selected draft invoices? This cannot be undone.")) {
      event.preventDefault();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAll}>
            Select all drafts
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearAll}>
            Clear
          </Button>
        </div>
        <form action={action} onSubmit={onSubmit}>
          <input type="hidden" name="invoice_ids" value={JSON.stringify(selected)} />
          <Button type="submit" variant="outline" size="sm" disabled={selected.length === 0}>
            Delete selected
          </Button>
        </form>
      </div>

      <DataTable
        columns={["Select", "Invoice", "Landlord", "Status", "Total", "Due", "PDF", "Actions"]}
        rows={invoices.map((invoice) => {
          const canDelete =
            invoice.status === "draft" &&
            (isAdmin || invoice.created_by_user_id === currentUserId);
          return [
            <input
              key={`${invoice.id}-select`}
              type="checkbox"
              disabled={!canDelete}
              checked={selected.includes(invoice.id)}
              onChange={() => toggle(invoice.id)}
            />,
            <span key={`${invoice.id}-number`} className="text-sm text-navy">
              {invoice.invoice_number}
            </span>,
            <span key={`${invoice.id}-landlord`} className="text-sm text-gray-600">
              {invoice.landlords?.name ?? "Landlord"}
            </span>,
            <InvoiceStatusBadge key={`${invoice.id}-status`} status={invoice.status} />,
            <span key={`${invoice.id}-total`} className="text-sm text-gray-600">
              {formatGBP(Number(invoice.total))}
            </span>,
            <span key={`${invoice.id}-due`} className="text-sm text-gray-600">
              {formatDate(invoice.due_date)}
            </span>,
            invoice.pdf_storage_path || isAdmin ? (
              <form key={`${invoice.id}-pdf`} action={onViewPdf.bind(null, invoice.id)}>
                <Button type="submit" variant="outline" size="sm">
                  View
                </Button>
              </form>
            ) : (
              <span key={`${invoice.id}-pdf`} className="text-xs text-gray-400">
                —
              </span>
            ),
            <Link key={`${invoice.id}-action`} href={`/invoices/${invoice.id}`} className="text-navy">
              View
            </Link>
          ];
        })}
      />
    </div>
  );
}
