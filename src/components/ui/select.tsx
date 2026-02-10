import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  options?: SelectOption[];
  onChange?: ((value: string) => void) | React.ChangeEventHandler<HTMLSelectElement>;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, children, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        if (typeof onChange === 'function') {
          try {
            (onChange as (value: string) => void)(e.target.value);
          } catch {
            (onChange as React.ChangeEventHandler<HTMLSelectElement>)(e);
          }
        }
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-foreground-muted mb-1.5">
            {label}
          </label>
        )}
        <select
          className={cn(
            "flex h-10 w-full rounded-lg border bg-surface-card px-3 py-2 text-sm",
            "border-border text-foreground-secondary",
            "transition-all duration-base cursor-pointer",
            "focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20",
            "disabled:bg-surface-inset disabled:text-foreground-muted disabled:cursor-not-allowed",
            "appearance-none bg-no-repeat bg-right",
            className
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: "right 0.5rem center",
            backgroundSize: "1.5em 1.5em",
            paddingRight: "2.5rem",
          }}
          ref={ref}
          onChange={handleChange}
          {...props}
        >
          {options
            ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
            : children}
        </select>
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
export type { SelectOption };
