import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive" | "gradient";
  accent?: "left" | "top" | "none";
  accentColor?: "brand" | "gold" | "success" | "info";
}

const accentColorMap = {
  brand: "border-brand",
  gold: "border-accent",
  success: "border-emerald-500",
  info: "border-blue-500"
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", accent = "none", accentColor = "brand", ...props }, ref) => {
    const baseStyles = "rounded-xl bg-white border border-slate-200/60";

    const variantStyles = {
      default: "shadow-card",
      elevated: "shadow-lg",
      interactive: "shadow-card transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 cursor-pointer",
      gradient: "bg-gradient-to-br from-white via-white to-slate-50/50 shadow-card"
    };

    const accentStyles = {
      left: `border-l-4 ${accentColorMap[accentColor]}`,
      top: `border-t-4 ${accentColorMap[accentColor]}`,
      none: ""
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
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

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-5 py-4 border-b border-slate-100", className)}
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
      className={cn("text-base font-semibold text-brand", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-slate-500 mt-0.5", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-5 py-4 bg-slate-50/50 border-t border-slate-100 rounded-b-xl", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

// Stat Card variant for dashboard
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
        "bg-white rounded-xl p-4 border border-slate-200/60 shadow-card",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-brand mt-1">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs font-medium mt-1 flex items-center gap-1",
              trend.direction === "up" ? "text-emerald-600" : "text-red-600"
            )}>
              {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-lg bg-brand-50 text-brand">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
);
StatCard.displayName = "StatCard";

export { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter, StatCard };
