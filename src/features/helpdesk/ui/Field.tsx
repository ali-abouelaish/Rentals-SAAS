import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

/** Field wrapper: visible label (+ optional "why" tooltip), hint under it, error under the control. */
export function Field({
  id,
  label,
  hint,
  tooltip,
  error,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  tooltip?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {tooltip && (
          <Tooltip content={tooltip}>
            <button
              type="button"
              aria-label={`About ${label}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-foreground-muted hover:text-foreground"
            >
              <Info size={13} />
            </button>
          </Tooltip>
        )}
      </div>
      <p className="text-xs text-foreground-muted mb-1.5">{hint}</p>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
