"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays, ArrowRight } from "lucide-react";

export function EarningsFilters({
  from,
  to
}: {
  from: string;
  to: string;
}) {
  const days = useMemo(() => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [from, to]);

  return (
    <form className="flex items-center gap-3">
      {/* Date inputs inline */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="relative flex-1 max-w-[180px]">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
          <Input
            type="date"
            name="from"
            defaultValue={from}
            className="pl-9 text-[13px]"
          />
        </div>

        <ArrowRight className="h-4 w-4 text-foreground-muted shrink-0" />

        <div className="relative flex-1 max-w-[180px]">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
          <Input
            type="date"
            name="to"
            defaultValue={to}
            className="pl-9 text-[13px]"
          />
        </div>
      </div>

      {/* Days badge + Apply */}
      <span className="text-xs font-medium text-foreground-muted bg-surface-inset px-3 py-1.5 rounded-full shrink-0">
        {days}d
      </span>

      <Button type="submit" size="sm">
        Apply
      </Button>
    </form>
  );
}
