"use client";

import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import { FIELD_BY_KEY, FIELD_GROUPS, LISTING_FIELDS } from "../domain/fields";
import type { ColumnMap, MappingSuggestion } from "../domain/types";
import { AUTO_ACCEPT_CONFIDENCE } from "../lib/field-map";

const selectCls =
  "h-9 w-full rounded-lg border border-border-muted bg-surface-card px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

const NOT_IMPORTED = "__none__";

/**
 * The confirm step of the import. Every sheet column gets a row showing what we
 * guessed, why (sample values), and a select to override it. Columns are never
 * imported on a guess alone — what the user leaves here is what gets stored on
 * the feed and replayed on every future pull.
 */
export function MappingTable({
  suggestions,
  columnMap,
  onChange,
}: {
  suggestions: MappingSuggestion[];
  columnMap: ColumnMap;
  onChange: (next: ColumnMap) => void;
}) {
  const usedFields = new Set(Object.values(columnMap));

  const setField = (header: string, field: string) => {
    const next = { ...columnMap };
    if (field === NOT_IMPORTED) {
      delete next[header];
    } else {
      // A field can only be filled once — clear any other column holding it.
      for (const [key, value] of Object.entries(next)) {
        if (value === field && key !== header) delete next[key];
      }
      next[header] = field;
    }
    onChange(next);
  };

  const mappedCount = Object.keys(columnMap).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-secondary">
          {mappedCount} of {suggestions.length} columns will be imported.
        </p>
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Confident match
          </span>
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Please check
          </span>
          <span className="inline-flex items-center gap-1">
            <MinusCircle className="h-3.5 w-3.5" /> Not imported
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-inset text-left text-xs uppercase tracking-wide text-foreground-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Column in your sheet</th>
              <th scope="col" className="px-3 py-2 font-medium">Example values</th>
              <th scope="col" className="px-3 py-2 font-medium w-[280px]">Imports into</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {suggestions.map((suggestion) => {
              const selected = columnMap[suggestion.header] ?? NOT_IMPORTED;
              const field = selected === NOT_IMPORTED ? null : FIELD_BY_KEY[selected];
              const wasGuessed = suggestion.field !== null;
              const uncertain =
                wasGuessed &&
                suggestion.confidence < AUTO_ACCEPT_CONFIDENCE &&
                selected === suggestion.field;

              return (
                <tr key={suggestion.header} className="align-top">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {selected === NOT_IMPORTED ? (
                        <MinusCircle className="h-4 w-4 shrink-0 text-foreground-muted" />
                      ) : uncertain ? (
                        <AlertTriangle
                          className="h-4 w-4 shrink-0 text-warning"
                          aria-label="Low-confidence guess"
                        />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                      )}
                      <span className="font-medium text-foreground break-words">
                        {suggestion.header}
                      </span>
                    </div>
                    {uncertain && (
                      <p className="mt-1 pl-6 text-xs text-warning">
                        Guessed from the column name — confirm it is right.
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-3 text-foreground-secondary">
                    {suggestion.samples.length === 0 ? (
                      <span className="text-foreground-muted">(column is empty)</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {suggestion.samples.map((sample, i) => (
                          <li key={i} className="truncate max-w-[260px]" title={sample}>
                            {sample}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <label className="sr-only" htmlFor={`map-${suggestion.header}`}>
                      Listing field for {suggestion.header}
                    </label>
                    <select
                      id={`map-${suggestion.header}`}
                      className={selectCls}
                      value={selected}
                      onChange={(e) => setField(suggestion.header, e.target.value)}
                      title="Pick which listing field this spreadsheet column fills. Leave as “Do not import” for columns that are only useful inside the sheet."
                    >
                      <option value={NOT_IMPORTED}>— Do not import —</option>
                      {FIELD_GROUPS.map((group) => (
                        <optgroup key={group} label={group}>
                          {LISTING_FIELDS.filter((f) => f.group === group).map((f) => (
                            <option
                              key={f.key}
                              value={f.key}
                              // Already claimed by another column; selecting it
                              // here would silently steal it.
                              disabled={usedFields.has(f.key) && selected !== f.key}
                            >
                              {f.label}
                              {usedFields.has(f.key) && selected !== f.key ? " (already used)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {field?.hint ?? "Choose the listing field this column fills."}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
