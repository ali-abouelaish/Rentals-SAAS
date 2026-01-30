"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
    <form className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs text-gray-500">From</label>
        <Input type="date" name="from" defaultValue={from} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-500">To</label>
        <Input type="date" name="to" defaultValue={to} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Payment method</label>
        <Select
          value="all"
          onChange={() => {}}
          options={[
            { label: "All methods", value: "all" },
            { label: "Cash", value: "cash" },
            { label: "Transfer", value: "transfer" },
            { label: "Card", value: "card" }
          ]}
          className="opacity-60"
          disabled
        />
      </div>
      <Badge className="border-muted text-gray-500">{days} days</Badge>
      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  );
}
