"use client";

/**
 * Bottom sheet used by the mobile shell (quick-create + "More" menu).
 * Built on the same Radix Dialog primitive as `components/ui/sheet.tsx`, but
 * slides up from the bottom and is mobile-only (`md:hidden`).
 */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const MobileSheet = DialogPrimitive.Root;
export const MobileSheetTrigger = DialogPrimitive.Trigger;
export const MobileSheetClose = DialogPrimitive.Close;

interface MobileSheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  title: string;
  /** Hide the visible title (still announced to screen readers). */
  hideTitle?: boolean;
}

export const MobileSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  MobileSheetContentProps
>(({ className, title, hideTitle = false, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[70] flex max-h-[86dvh] flex-col overflow-hidden rounded-t-[26px] bg-surface-card shadow-2xl md:hidden",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        "data-[state=open]:duration-300 data-[state=closed]:duration-200",
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong" />
      <div className="flex items-center justify-between px-5 pb-3 pt-3">
        <DialogPrimitive.Title
          className={cn("text-base font-semibold text-foreground", hideTitle && "sr-only")}
        >
          {title}
        </DialogPrimitive.Title>
        <DialogPrimitive.Close
          className="-mr-1 rounded-full p-1.5 text-foreground-muted transition-colors hover:bg-surface-inset hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-border-ring/40"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </DialogPrimitive.Close>
      </div>
      <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+18px)]">
        {children}
      </div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
MobileSheetContent.displayName = "MobileSheetContent";
