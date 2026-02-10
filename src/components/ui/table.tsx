import * as React from "react";
import { cn } from "@/lib/utils/cn";

/* ─── Table Container ───────────────────────── */

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="overflow-hidden rounded-xl border border-border">
      <table
        ref={ref}
        className={cn("w-full text-sm", className)}
        {...props}
      />
    </div>
  )
);
Table.displayName = "Table";

/* ─── Table Header ──────────────────────────── */

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-brand text-brand-fg", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

/* ─── Table Head Cell ───────────────────────── */

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-brand-fg",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

/* ─── Table Body ────────────────────────────── */

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("bg-surface-card divide-y divide-border-border-muted", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

/* ─── Table Row ─────────────────────────────── */

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "transition-colors duration-base even:bg-surface-inset/50 hover:bg-brand-subtle/50",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

/* ─── Table Cell ────────────────────────────── */

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-4 py-3 text-foreground-secondary", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableHead, TableBody, TableRow, TableCell };
