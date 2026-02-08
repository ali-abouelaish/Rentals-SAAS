import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          {label}
        </label>
      )}
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm",
          "border-slate-200 text-slate-700",
          "placeholder:text-slate-400",
          "transition-all duration-150",
          "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
          "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
          error && "border-red-300 focus:border-red-500 focus:ring-red-200",
          className
        )}
        ref={ref}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
);

Input.displayName = "Input";

export { Input };
