"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { InvoiceStatusBadge } from "@/features/invoices/ui/InvoiceStatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { bulkDeleteInvoicesAction } from "@/features/invoices/actions/invoices";
import { toast } from "sonner";
import { FileText, Trash2, ArrowUpRight, FileText as PdfIcon } from "lucide-react";

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
  const [state, action] = useFormState(bulkDeleteInvoicesAction, { ok: false });

  // Only drafts created by user (or anyone if admin) can be selected for delete
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

  const hasSelections = selected.length > 0;

  if (invoices.length === 0) {
    return (
      <div className="rounded-bento bg-surface-card shadow-bento py-16 flex flex-col items-center justify-center gap-3">
        <FileText className="h-12 w-12 text-foreground-muted" />
        <p className="text-foreground-secondary">No invoices found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Bulk Actions ──── */}
      {selectableIds.length > 0 && (
        <div className="flex items-center justify-between bg-surface-inset px-4 py-2 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={selectableIds.length > 0 && selected.length === selectableIds.length}
                onChange={(e) => (e.target.checked ? selectAll() : clearAll())}
                className="rounded border-border text-brand focus:ring-brand"
              />
              Select all drafts
            </label>
            {hasSelections && (
              <span className="text-sm font-medium text-brand">
                {selected.length} selected
              </span>
            )}
          </div>
          <form action={action} onSubmit={onSubmit}>
            <input type="hidden" name="invoice_ids" value={JSON.stringify(selected)} />
            <Button
              type="submit"
              variant="outline"
              size="xs"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              disabled={!hasSelections}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Selected
            </Button>
          </form>
        </div>
      )}

      {/* ── Card List ──── */}
      <div className="rounded-bento bg-surface-card shadow-bento divide-y divide-border overflow-hidden">
        {invoices.map((invoice) => {
          const isSelected = selected.includes(invoice.id);
          const canDelete =
            invoice.status === "draft" &&
            (isAdmin || invoice.created_by_user_id === currentUserId);

          return (
            <div
              key={invoice.id}
              className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isSelected ? "bg-brand-subtle/30" : "hover:bg-surface-inset"
                }`}
            >
              {/* Checkbox (only for deletable drafts) */}
              <div className="shrink-0">
                <input
                  type="checkbox"
                  disabled={!canDelete}
                  checked={isSelected}
                  onChange={() => toggle(invoice.id)}
                  className={`rounded border-border text-brand focus:ring-brand ${!canDelete ? "opacity-0 pointer-events-none" : ""
                    }`}
                />
              </div>

              {/* Icon */}
              <div className="h-10 w-10 rounded-xl bg-surface-inset flex items-center justify-center shrink-0 text-foreground-muted">
                <FileText className="h-5 w-5" />
              </div>

              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="text-sm font-semibold text-brand hover:underline"
                  >
                    {invoice.invoice_number}
                  </Link>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mt-0.5 truncate">
                  <span className="font-medium text-foreground-secondary">
                    {invoice.landlords?.name ?? "Unknown Landlord"}
                  </span>
                  <span>·</span>
                  <span>Due {formatDate(invoice.due_date)}</span>
                </div>
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {formatGBP(Number(invoice.total))}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {(invoice.pdf_storage_path || isAdmin) && (
                  <form action={onViewPdf.bind(null, invoice.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-foreground-muted hover:text-foreground"
                      title="View PDF"
                    >
                      <PdfIcon className="h-4 w-4" />
                    </Button>
                  </form>
                )}
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-foreground-muted hover:bg-surface-highlight hover:text-foreground transition-colors"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
