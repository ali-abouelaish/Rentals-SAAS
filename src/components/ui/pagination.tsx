"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    className,
}: PaginationProps) {
    // Generate page numbers to show
    const getPageNumbers = () => {
        const pages: (number | "ellipsis")[] = [];

        if (totalPages <= 7) {
            // Show all pages if 7 or fewer
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push("ellipsis");
            }

            // Show pages around current
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push("ellipsis");
            }

            // Always show last page
            pages.push(totalPages);
        }

        return pages;
    };

    if (totalPages <= 1) return null;

    return (
        <nav
            role="navigation"
            aria-label="Pagination"
            className={cn("flex items-center justify-center gap-1", className)}
        >
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="gap-1 px-2"
            >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex items-center gap-1">
                {getPageNumbers().map((page, index) =>
                    page === "ellipsis" ? (
                        <span
                            key={`ellipsis-${index}`}
                            className="flex h-9 w-9 items-center justify-center"
                        >
                            <MoreHorizontal className="h-4 w-4 text-foreground-muted" />
                        </span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page)}
                            className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-all",
                                currentPage === page
                                    ? "bg-brand text-brand-fg shadow-sm"
                                    : "text-foreground-secondary hover:bg-surface-100 hover:text-brand"
                            )}
                        >
                            {page}
                        </button>
                    )
                )}
            </div>

            <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="gap-1 px-2"
            >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </nav>
    );
}

// Simple info display for page counts
export function PaginationInfo({
    currentPage,
    pageSize,
    totalItems,
    className,
}: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    className?: string;
}) {
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    return (
        <p className={cn("text-sm text-foreground-secondary", className)}>
            Showing <span className="font-medium text-brand">{start}</span> to{" "}
            <span className="font-medium text-brand">{end}</span> of{" "}
            <span className="font-medium text-brand">{totalItems}</span> results
        </p>
    );
}
