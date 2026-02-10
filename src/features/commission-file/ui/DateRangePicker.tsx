"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DateRangePicker({
  defaultFrom,
  defaultTo
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const applyRange = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <p className="text-xs text-foreground-secondary">From</p>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <p className="text-xs text-foreground-secondary">To</p>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button type="button" variant="outline" onClick={applyRange}>
        Apply
      </Button>
    </div>
  );
}
