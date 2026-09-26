import * as React from "react";
import { cn } from "@/lib/utils/cn";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        // 44px on a phone, the desktop 40px from `md`. Also `text-base` below
        // `sm`: iOS Safari zooms the whole page in when a focused field's text
        // is under 16px, and never zooms back out.
        "flex h-11 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-base text-foreground md:h-10 sm:text-sm",
        "placeholder:text-foreground-muted",
        "focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20",
        "transition-all duration-base ease-default",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Input.displayName = "Input";

export { Input };
