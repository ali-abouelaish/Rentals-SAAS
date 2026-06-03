"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Current value in YYYY-MM. */
  value: string;
  /** Max selectable month (YYYY-MM). Defaults to current month. */
  max?: string;
  /** Min selectable month (YYYY-MM). Defaults to 36 months back. */
  min?: string;
};

function parse(value: string): { year: number; month: number } {
  const [y, m] = value.split("-").map((n) => parseInt(n, 10));
  return { year: y, month: m };
}

function format(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function shift(value: string, delta: number): string {
  const { year, month } = parse(value);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return format(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

function defaultMax(): string {
  const d = new Date();
  return format(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

function defaultMin(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 36);
  return format(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

function monthOptions(min: string, max: string): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  let cursor = max;
  while (cursor >= min) {
    const { year, month } = parse(cursor);
    const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    out.push({ value: cursor, label });
    cursor = shift(cursor, -1);
  }
  return out;
}

export function MonthPicker({ value, max, min }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const effectiveMax = max ?? defaultMax();
  const effectiveMin = min ?? defaultMin();
  const options = useMemo(() => monthOptions(effectiveMin, effectiveMax), [effectiveMin, effectiveMax]);

  const goTo = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const prev = shift(value, -1);
  const next = shift(value, 1);
  const canPrev = prev >= effectiveMin;
  const canNext = next <= effectiveMax;

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-card p-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!canPrev || pending}
        onClick={() => canPrev && goTo(prev)}
        aria-label="Previous month"
        className="h-7 w-7"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <select
        value={value}
        onChange={(e) => goTo(e.target.value)}
        disabled={pending}
        className="h-7 rounded-md bg-transparent px-2 text-xs font-semibold text-foreground focus:outline-none"
        aria-label="Select month"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!canNext || pending}
        onClick={() => canNext && goTo(next)}
        aria-label="Next month"
        className="h-7 w-7"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
