import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[90px] w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm shadow-xs",
        "placeholder:text-foreground-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-ring/20 focus-visible:border-brand",
        "transition-all duration-base",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";

export { Textarea };
