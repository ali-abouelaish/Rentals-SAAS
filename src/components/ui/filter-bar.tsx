import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Search } from "lucide-react";

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> { }

const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
    ({ className, children, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "bg-surface-inset",
                "rounded-xl p-4 border border-border",
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
);
FilterBar.displayName = "FilterBar";

interface FilterRowProps extends React.HTMLAttributes<HTMLDivElement> { }

const FilterRow = React.forwardRef<HTMLDivElement, FilterRowProps>(
    ({ className, children, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex flex-wrap items-end gap-3", className)}
            {...props}
        >
            {children}
        </div>
    )
);
FilterRow.displayName = "FilterRow";

interface FilterGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    label?: string;
}

const FilterGroup = React.forwardRef<HTMLDivElement, FilterGroupProps>(
    ({ className, label, children, ...props }, ref) => (
        <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
            {label && (
                <label className="text-xs font-medium text-foreground-muted">{label}</label>
            )}
            {children}
        </div>
    )
);
FilterGroup.displayName = "FilterGroup";

interface FilterSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

const FilterSearch = React.forwardRef<HTMLInputElement, FilterSearchProps>(
    ({ className, label, ...props }, ref) => (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label className="text-xs font-medium text-foreground-muted">{label}</label>
            )}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <input
                    ref={ref}
                    className={cn(
                        "h-10 w-full rounded-lg border bg-surface-card pl-9 pr-3 text-sm",
                        "border-border text-foreground placeholder:text-foreground-muted",
                        "focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20",
                        className
                    )}
                    {...props}
                />
            </div>
        </div>
    )
);
FilterSearch.displayName = "FilterSearch";

// Status pill filter tabs
interface FilterPillsProps extends React.HTMLAttributes<HTMLDivElement> { }

const FilterPills = React.forwardRef<HTMLDivElement, FilterPillsProps>(
    ({ className, children, ...props }, ref) => (
        <div ref={ref} className={cn("flex flex-wrap gap-2", className)} {...props}>
            {children}
        </div>
    )
);
FilterPills.displayName = "FilterPills";

interface FilterPillProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    active?: boolean;
}

const FilterPill = React.forwardRef<HTMLAnchorElement, FilterPillProps>(
    ({ className, active = false, children, ...props }, ref) => (
        <a
            ref={ref}
            className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-full border cursor-pointer",
                "transition-all duration-150",
                active
                    ? "bg-brand text-brand-fg border-brand"
                    : "border-border text-foreground-secondary bg-surface-card hover:border-brand/30 hover:text-brand hover:bg-brand-subtle/50",
                className
            )}
            {...props}
        >
            {children}
        </a>
    )
);
FilterPill.displayName = "FilterPill";

interface FilterActionsProps extends React.HTMLAttributes<HTMLDivElement> { }

const FilterActions = React.forwardRef<HTMLDivElement, FilterActionsProps>(
    ({ className, children, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex items-end gap-2", className)}
            {...props}
        >
            {children}
        </div>
    )
);
FilterActions.displayName = "FilterActions";

export {
    FilterBar,
    FilterRow,
    FilterGroup,
    FilterSearch,
    FilterPills,
    FilterPill,
    FilterActions
};
