import type { BankName } from "../parser";

export const BANK_META: Record<BankName, { label: string; chipClass: string }> = {
  barclays: {
    label: "Barclays",
    chipClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  },
  hsbc: {
    label: "HSBC",
    chipClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  },
  lloyds: {
    label: "Lloyds",
    chipClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  },
  natwest: {
    label: "NatWest",
    chipClass:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
  },
  santander: {
    label: "Santander",
    chipClass:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900",
  },
  unknown: {
    label: "Unknown bank",
    chipClass: "bg-surface-inset text-foreground-secondary border-border",
  },
};

export function formatPence(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "—";
  const pounds = pence / 100;
  return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateRange(from: string | null, to: string | null): string {
  if (!from && !to) return "—";
  if (from && to) {
    return `${formatShortDate(from)} – ${formatShortDate(to)}`;
  }
  return formatShortDate(from ?? to ?? "");
}

export function formatShortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
