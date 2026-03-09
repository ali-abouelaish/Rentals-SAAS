"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { EarningsTransaction } from "../domain/types";

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ExportButton({
  transactions,
  from,
  to
}: {
  transactions: EarningsTransaction[];
  from: string;
  to: string;
}) {
  const handleExport = () => {
    if (!transactions.length) {
      toast("No transactions in this range to export.");
      return;
    }
    const headers = ["Date", "Property", "Tenant", "Rent (£)", "Earnings (£)"];
    const rows = transactions.map((t) => [
      t.created_at.slice(0, 10),
      escapeCsvCell(t.property_name),
      escapeCsvCell(t.tenant_name ?? ""),
      (t.rent_amount ?? 0).toFixed(2),
      t.amount.toFixed(2)
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `earnings-transactions-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Export downloaded.");
  };

  return (
    <Button type="button" variant="outline" onClick={handleExport}>
      <Download size={14} className="mr-2" />
      Export
    </Button>
  );
}
