"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

function getYTD() {
  const now = new Date();
  return { start: `${now.getFullYear()}-01-01`, end: now.toISOString().slice(0, 10) };
}

function getQuickRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const QUICK_CHIPS: Array<{ label: string; getRange: () => { start: string; end: string } }> = [
  { label: "7d",  getRange: () => getQuickRange(7) },
  { label: "30d", getRange: () => getQuickRange(30) },
  { label: "90d", getRange: () => getQuickRange(90) },
  { label: "YTD", getRange: getYTD },
];

function humanLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const today = new Date().toISOString().slice(0, 10);
  const diffDays = Math.round((e.getTime() - s.getTime()) / 86400000);

  // Check YTD
  if (start === `${e.getFullYear()}-01-01` && end === today) return "Year to date";

  // Named quick ranges
  if (diffDays === 7)  return "Last 7 days";
  if (diffDays === 30) return "Last 30 days";
  if (diffDays === 90) return "Last 90 days";

  // Custom: format as "1 Jan – 31 Mar"
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(s)} – ${fmt(e)}`;
}

export function MeDateRangeFilter({ start, end }: { start: string; end: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apply = (s: string, e: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("start", s);
    params.set("end", e);
    router.push(`/me?${params.toString()}`, { scroll: false });
  };

  const handleSubmit = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const s = (form.querySelector('[name="start"]') as HTMLInputElement)?.value;
    const e = (form.querySelector('[name="end"]') as HTMLInputElement)?.value;
    if (s && e) apply(s, e);
  };

  const label = humanLabel(start, end);

  return (
    <div className="rounded-bento bg-surface-card shadow-bento px-5 py-3.5">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Human-readable label */}
          <div className="flex items-center gap-1.5 mr-1">
            <CalendarDays className="h-4 w-4 text-brand shrink-0" />
            <span className="text-sm font-semibold text-foreground">{label}</span>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* Date inputs */}
          <div className="flex items-center gap-2">
            <Input type="date" name="start" defaultValue={start} className="w-[138px] text-xs h-8" />
            <span className="text-foreground-muted text-sm">–</span>
            <Input type="date" name="end" defaultValue={end} className="w-[138px] text-xs h-8" />
          </div>

          {/* Quick chips */}
          <div className="flex items-center gap-1">
            {QUICK_CHIPS.map((chip) => {
              const range = chip.getRange();
              const active = range.start === start && range.end === end;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => apply(range.start, range.end)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors",
                    active
                      ? "bg-brand text-brand-fg border-brand shadow-sm"
                      : "bg-surface-inset border-border text-foreground-secondary hover:bg-surface-card hover:text-foreground"
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <Button type="submit" size="sm" variant="outline" className="ml-auto h-8">
            Apply
          </Button>
        </div>
      </form>
    </div>
  );
}
