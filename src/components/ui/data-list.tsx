import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

/**
 * One dataset, two shapes: a table from `md` up, a stack of cards below it.
 *
 * `<Table>` only ever offered `overflow-x-auto`, which is a technicality rather
 * than a design — a ten-column work order table inside a 360px viewport is
 * scrollable and unreadable, and the columns that matter are the ones you have
 * to drag to reach. Here each column declares how much it matters once, and the
 * phone layout uses that ranking instead of showing everything at 1/10th width.
 *
 *   primary   — the row's identity. Card heading; the one thing you scan for.
 *   secondary — label/value pairs in the card body. The default.
 *   detail    — table only. Present on a wide screen, dropped on a phone.
 *   action    — buttons. Pinned to the card footer, right-aligned in the table.
 *
 * Reach for a plain `<Table>` instead when the grid itself is the point (a
 * financial report read column-against-column); give that one a sticky first
 * column and let it scroll.
 */
export type DataListColumnPriority = "primary" | "secondary" | "detail" | "action";

export type DataListColumn<T> = {
  /** Stable identity for the column. Also the React key. */
  key: string;
  /** Column heading. Doubles as the card's label for `secondary` columns. */
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Defaults to `"secondary"`. */
  priority?: DataListColumnPriority;
  /** Applied to the `<td>`/`<th>` in the table layout. */
  className?: string;
  /** Applied to the `<th>` only. */
  headClassName?: string;
};

export type DataListProps<T> = {
  rows: readonly T[];
  columns: ReadonlyArray<DataListColumn<T>>;
  getRowKey: (row: T, index: number) => React.Key;
  /** Makes rows activatable in both layouts, keyboard included. */
  onRowClick?: (row: T) => void;
  /** Rendered in place of both layouts when `rows` is empty. */
  empty?: React.ReactNode;
  /** Accessible description of the table, for screen readers. */
  caption?: string;
  className?: string;
};

function priorityOf<T>(column: DataListColumn<T>): DataListColumnPriority {
  return column.priority ?? "secondary";
}

export function DataList<T>({
  rows,
  columns,
  getRowKey,
  onRowClick,
  empty,
  caption,
  className,
}: DataListProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  const primary = columns.filter((c) => priorityOf(c) === "primary");
  const secondary = columns.filter((c) => priorityOf(c) === "secondary");
  const actions = columns.filter((c) => priorityOf(c) === "action");

  // A caller who never sets a priority still gets a usable card: promote the
  // first column to the heading rather than rendering a title-less stack.
  const cardHeading = primary.length > 0 ? primary : columns.slice(0, 1);
  const cardBody =
    primary.length > 0 ? secondary : columns.slice(1).filter((c) => priorityOf(c) !== "detail");

  const interactive = Boolean(onRowClick);

  return (
    <div className={className}>
      {/* ── Wide screens — the table ───────────────────────── */}
      <div className="hidden md:block">
        <Table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    priorityOf(column) === "action" && "text-right",
                    column.headClassName
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={getRowKey(row, index)}
                onClick={interactive ? () => onRowClick?.(row) : undefined}
                className={cn(interactive && "cursor-pointer")}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      priorityOf(column) === "action" && "text-right",
                      column.className
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Phones — one card per row ──────────────────────── */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row, index) => {
          const body = (
            <>
              <div className="flex flex-col gap-1">
                {cardHeading.map((column) => (
                  <div
                    key={column.key}
                    className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]"
                  >
                    {column.cell(row)}
                  </div>
                ))}
              </div>

              {cardBody.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  {cardBody.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                        {column.header}
                      </dt>
                      <dd className="mt-0.5 text-sm text-foreground-secondary [overflow-wrap:anywhere]">
                        {column.cell(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          );

          return (
            <li
              key={getRowKey(row, index)}
              className="overflow-hidden rounded-xl border border-border bg-surface-card"
            >
              {/* The action row sits outside the activatable region — action
                  cells hold buttons of their own, and a button inside a button
                  is invalid markup that swallows the inner click. */}
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onRowClick?.(row)}
                  className="block w-full p-4 text-left transition-colors active:bg-brand-subtle/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-ring"
                >
                  {body}
                </button>
              ) : (
                <div className="p-4">{body}</div>
              )}

              {actions.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-muted px-4 py-3">
                  {actions.map((column) => (
                    <React.Fragment key={column.key}>{column.cell(row)}</React.Fragment>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
