import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Option = { label: string; value: string };

export function Select({
  options,
  value,
  onChange,
  className,
  disabled
}: {
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-xl border border-muted bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        className
      )}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
