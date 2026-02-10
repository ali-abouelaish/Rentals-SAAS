import * as React from "react";
import { cn } from "@/lib/utils/cn";

/* ─── Card ──────────────────────────────────── */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive" | "gradient";
  accent?: "left" | "top" | "none";
  accentColor?: "brand" | "gold" | "success" | "info";
}

const accentColorMap = {
  brand: "border-brand",
  gold: "border-accent",
  success: "border-success",
  info: "border-info",
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant = "default", accent = "none", accentColor = "brand", ...props },
    ref
  ) => {
    const variantStyles = {
      default: "shadow-card",
      elevated: "shadow-lg",
      interactive:
        "shadow-card transition-all duration-base hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer",
      gradient: "bg-gradient-to-br from-surface-card to-surface-inset shadow-card",
    };

    const accentStyles = {
      left: `border-l-4 ${accentColorMap[accentColor]}`,
      top: `border-t-4 ${accentColorMap[accentColor]}`,
      none: "",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl bg-surface-card border border-border",
          variantStyles[variant],
          accentStyles[accent],
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

/* ─── Subcomponents ─────────────────────────── */

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-5 py-4 border-b border-border-border-muted", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-foreground-secondary mt-0.5", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "px-5 py-4 bg-surface-inset border-t border-border-border-muted rounded-b-xl",
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

/* ─── Stat Card ─────────────────────────────── */

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  trend?: { value: number; direction: "up" | "down" };
  icon?: React.ReactNode;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, trend, icon, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-surface-card rounded-xl p-4 border border-border shadow-card",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {trend && (
            <p
              className={cn(
                "text-xs font-medium mt-1 flex items-center gap-1",
                trend.direction === "up" ? "text-success" : "text-error"
              )}
            >
              {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-lg bg-brand-subtle text-brand">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
);
StatCard.displayName = "StatCard";

export { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter, StatCard };
