import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  helper,
  variant = "muted",
}: {
  label: string;
  value: string;
  helper?: string;
  variant?: "primary" | "accent" | "muted";
}) {
  const variants = {
    primary: "bg-brand text-brand-fg border-brand hover:bg-brand-hover",
    accent: "bg-accent text-accent-fg border-accent hover:bg-accent-hover",
    muted: "bg-surface-inset border-border hover:border-accent/20",
  };

  const labelColors = {
    primary: "text-brand-fg/70",
    accent: "text-accent-fg/70",
    muted: "text-foreground-muted",
  };

  const valueColors = {
    primary: "text-brand-fg",
    accent: "text-accent-fg",
    muted: "text-foreground",
  };

  return (
    <Card className={cn("transition-all duration-base", variants[variant])}>
      <CardContent className="p-6 space-y-2">
        <p className={cn("text-xs font-medium uppercase tracking-wider", labelColors[variant])}>
          {label}
        </p>
        <p className={cn("text-3xl font-bold", valueColors[variant])}>{value}</p>
        {helper ? (
          <p className={cn("text-xs", labelColors[variant])}>{helper}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
