import { cn } from "@/lib/utils/cn";
import type { Portfolio } from "../domain/types";

interface PortfolioBadgeProps {
  portfolio: Pick<Portfolio, "name" | "color">;
  size?: "sm" | "md";
  className?: string;
}

export function PortfolioBadge({ portfolio, size = "sm", className }: PortfolioBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold tracking-wide uppercase",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        className
      )}
      style={{
        backgroundColor: `${portfolio.color}22`,
        color: portfolio.color,
        border: `1px solid ${portfolio.color}44`,
      }}
    >
      {portfolio.name}
    </span>
  );
}
