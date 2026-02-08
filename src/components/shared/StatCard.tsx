import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  helper,
  variant = "muted"
}: {
  label: string;
  value: string;
  helper?: string;
  variant?: "primary" | "accent" | "muted";
}) {
  const variants = {
    primary: "bg-brand text-white border-brand hover:bg-brand/90",
    accent: "bg-accent text-white border-accent hover:bg-accent/90",
    muted: "bg-surface-200 border-surface-300 hover:border-accent/20"
  };

  const labelColors = {
    primary: "text-white/70",
    accent: "text-white/70",
    muted: "text-muted-foreground"
  };

  const valueColors = {
    primary: "text-white",
    accent: "text-white",
    muted: "text-brand"
  };

  return (
    <Card className={cn("transition-all duration-200", variants[variant])}>
      <CardContent className="p-6 space-y-2">
        <p className={cn("text-xs font-medium uppercase tracking-wider", labelColors[variant])}>{label}</p>
        <p className={cn("text-3xl font-bold", valueColors[variant])}>{value}</p>
        {helper ? <p className={cn("text-xs", labelColors[variant])}>{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
