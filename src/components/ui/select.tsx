import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  options?: SelectOption[];
  placeholder?: string;
  onChange?: ((value: string) => void) | React.ChangeEventHandler<HTMLSelectElement>;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, placeholder, children, onChange, ...props }, ref) => {
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
            "flex h-8 w-full rounded-lg border bg-gradient-to-br from-surface-card to-surface-app/80 px-2 py-1",
            "text-xs border-border/70 text-foreground-secondary shadow-sm",
            "transition-all duration-150 cursor-pointer",
            "hover:border-brand hover:shadow-[0_0_0_1px_rgba(59,130,246,0.25)]",
            "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/25",
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
          {placeholder && (
            <option value="" disabled hidden>{placeholder}</option>
          )}
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
