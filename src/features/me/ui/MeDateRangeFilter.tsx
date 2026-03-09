"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

function getYTD() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10)
  };
}

/** Period from 11th (previous month) to 10th (current or previous month). */
function get11thTo10thPeriod() {
  const now = new Date();
  const day = now.getDate();
  const endDate =
    day >= 11
      ? new Date(now.getFullYear(), now.getMonth(), 10)
      : new Date(now.getFullYear(), now.getMonth() - 1, 10);
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 11);
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10)
  };
}

function getQuickRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

const QUICK_CHIPS: Array<{ label: string; getRange: () => { start: string; end: string } }> = [
  { label: "11th–10th", getRange: get11thTo10thPeriod },
  { label: "7d", getRange: () => getQuickRange(7) },
  { label: "30d", getRange: () => getQuickRange(30) },
  { label: "90d", getRange: () => getQuickRange(90) },
  { label: "YTD", getRange: getYTD }
];

type MeDateRangeFilterProps = {
  start: string;
  end: string;
};

export function MeDateRangeFilter({ start, end }: MeDateRangeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apply = (newStart: string, newEnd: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("start", newStart);
    params.set("end", newEnd);
    router.push(`/me?${params.toString()}`, { scroll: false });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const startVal = (form.querySelector('[name="start"]') as HTMLInputElement)?.value;
    const endVal = (form.querySelector('[name="end"]') as HTMLInputElement)?.value;
    if (startVal && endVal) apply(startVal, endVal);
  };

  return (
    <div className="rounded-bento bg-surface-card shadow-bento px-5 py-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-[140px]">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
            <Input type="date" name="start" defaultValue={start} className="pl-9 text-[13px]" />
          </div>
          <span className="text-foreground-muted">–</span>
          <div className="relative flex-1 max-w-[140px]">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
            <Input type="date" name="end" defaultValue={end} className="pl-9 text-[13px]" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                const { start: s, end: e } = chip.getRange();
                apply(s, e);
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface-inset text-foreground-secondary hover:bg-surface-card hover:text-foreground transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
      </form>
    </div>
  );
}
