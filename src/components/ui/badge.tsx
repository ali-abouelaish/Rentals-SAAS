import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {}

function Badge({ className, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-muted px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
