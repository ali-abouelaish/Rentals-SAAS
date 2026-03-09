import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
};

export function StatCard({ label, value, icon: Icon, iconColor = "text-emerald-600", iconBg = "bg-emerald-50" }: StatCardProps) {
  return (
    <div className="rounded-bento bg-surface-card p-5 shadow-bento hover:shadow-bento-hover transition-all duration-base">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-foreground mt-2 tabular-nums">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}
