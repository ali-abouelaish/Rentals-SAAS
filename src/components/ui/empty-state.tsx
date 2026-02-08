import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center py-12 px-4 text-center",
                className
            )}
        >
            {Icon && (
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <Icon className="h-8 w-8 text-gray-400" />
                </div>
            )}
            <h3 className="text-lg font-semibold text-brand mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>
            )}
            {action && (
                <Button onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    );
}
