export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2
  }).format(value);
}

export const formatGBP = formatCurrency;

/**
 * Format integer pence as GBP. Newer modules (owner statements, finances,
 * deposits) store money as integer pence; older rental-agency tables store
 * pounds as numeric and should use formatGBP directly.
 */
export function formatPence(pence: number | null | undefined) {
  return formatCurrency(Number(pence ?? 0) / 100);
}

/** Pounds → integer pence, e.g. for a numeric(10,2) column read as pounds. */
export function poundsToPence(pounds: number | null | undefined): number {
  return Math.round(Number(pounds ?? 0) * 100);
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}
