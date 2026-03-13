"use client";

import { useRouter } from "next/navigation";

type Option = { value: string; label: string };

export function InvoicesStatusFilter({
  currentStatus,
  currentSearch,
  options,
}: {
  currentStatus: string;
  currentSearch: string;
  options: Option[];
}) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams();
    if (currentSearch) params.set("q", currentSearch);
    const v = e.target.value;
    if (v && v !== "all") params.set("status", v);
    params.set("page", "1");
    const qs = params.toString();
    router.push(`/invoices${qs ? `?${qs}` : ""}`);
  };

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      className="flex h-10 w-full rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
      aria-label="Filter by status"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
