import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/* ─── Standard Page Header ─────────────────── */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-foreground-secondary mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/* ─── Hero Page Header (gradient banner) ───── */

interface PageHeroProps {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHero({ title, subtitle, badge, action, className }: PageHeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-8 text-brand-fg",
        "bg-brand",
        className
      )}
      style={{
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {/* Decorative elements */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full -translate-y-1/2 translate-x-1/2 bg-accent/10" />
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full translate-y-1/2 -translate-x-1/2 bg-accent/5" />

      {/* Content */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {badge && (
            <div className="flex items-center gap-2 text-accent mb-2">
              <span className="text-sm font-medium">{badge}</span>
            </div>
          )}
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-brand-fg/70 text-lg mt-1">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
