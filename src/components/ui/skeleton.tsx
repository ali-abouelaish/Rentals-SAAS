import * as React from "react";
import { cn } from "@/lib/utils/cn";

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-xl bg-gray-200",
                className
            )}
            {...props}
        />
    );
}

function SkeletonText({
    lines = 3,
    className,
}: {
    lines?: number;
    className?: string;
}) {
    return (
        <div className={cn("space-y-2", className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn(
                        "h-4",
                        i === lines - 1 && "w-3/4"
                    )}
                />
            ))}
        </div>
    );
}

function SkeletonCard({ className }: { className?: string }) {
    return (
        <div className={cn("rounded-2xl border border-surface-300 bg-white p-6", className)}>
            <Skeleton className="h-6 w-1/3 mb-4" />
            <SkeletonText lines={2} />
        </div>
    );
}

function SkeletonTable({
    rows = 5,
    columns = 4,
    className,
}: {
    rows?: number;
    columns?: number;
    className?: string;
}) {
    return (
        <div className={cn("space-y-3", className)}>
            {/* Header */}
            <div className="flex gap-4 pb-3 border-b">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-4">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <Skeleton
                            key={colIndex}
                            className={cn(
                                "h-4 flex-1",
                                colIndex === 0 && "w-1/4"
                            )}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable };
