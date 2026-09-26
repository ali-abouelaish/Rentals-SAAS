import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-base ease-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-ring/40 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-fg hover:bg-brand-hover shadow-sm",
        secondary: "bg-accent text-accent-fg hover:bg-accent-hover shadow-sm",
        outline:
          "border border-border bg-surface-card text-foreground-secondary hover:bg-surface-inset hover:text-foreground hover:border-border-strong",
        ghost:
          "text-foreground-secondary hover:bg-surface-inset hover:text-foreground",
        destructive: "bg-error text-brand-fg hover:bg-error/90 shadow-sm",
        link: "text-foreground-link underline-offset-4 hover:underline p-0 h-auto",
        success: "bg-success text-brand-fg hover:bg-success/90 shadow-sm",
      },
      size: {
        xs: "h-7 px-2 text-xs",
        /**
         * `sm` is the app's general-purpose small button, not a dense-row size:
         * of 430 usages only 13 sit inside a table cell. It reaches 44px under
         * a thumb and keeps its 32px desktop height. `xs` (20 usages) really is
         * for tight inline spots and stays put.
         */
        sm: "h-11 min-w-11 px-3 text-xs md:h-8 md:min-w-0",
        /**
         * The general-purpose sizes reach 44px under a thumb and keep their
         * desktop heights from `md`. `xs` and `sm` are deliberately dense —
         * they sit inside table rows and inline toolbars, where forcing 44px
         * would stretch every row — so those stay put and get handled in
         * context.
         */
        md: "h-11 min-w-11 px-4 md:h-9 md:min-w-0",
        lg: "h-11 min-w-11 px-5 md:h-10 md:min-w-0",
        xl: "h-11 px-6 text-base",
        /**
         * 36px on a mouse, 44px under a thumb.
         *
         * An icon-only button has no label to aim at, so it is the one variant
         * where the desktop size is genuinely unhittable on a phone. The text
         * sizes keep their heights — their labels give them a wide target, and
         * raising them all would stretch every dense row in the app.
         */
        icon: "h-11 w-11 p-0 md:h-9 md:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
