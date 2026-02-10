import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface FilterPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function FilterPanel({ children, className, ...props }: FilterPanelProps) {
    return (
        <div
            className={cn(
                "bg-gradient-to-r from-slate-50/80 to-blue-50/30 rounded-xl p-4 border border-border/60",
                "shadow-sm",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function FilterRow({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("flex flex-wrap items-center gap-3", className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function FilterGroup({
    label,
    children,
    className,
}: {
    label?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {label && (
                <label className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">
                    {label}
                </label>
            )}
            {children}
        </div>
    );
}

export function FilterActions({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("flex items-center gap-2 ml-auto", className)}
            {...props}
        >
            {children}
        </div>
    );
}
