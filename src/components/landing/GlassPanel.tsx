import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  strong?: boolean;
};

export function GlassPanel({
  children,
  className,
  strong = false,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        strong ? "glass-panel-strong" : "glass-panel",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
