import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "left" | "right";
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = "right", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      /*
       * Do not hand focus to the first action button.
       *
       * Radix focuses the first focusable descendant on open, which in these
       * drawers is a toolbar button — and a Radix tooltip opens on focus. On a
       * phone, where the header stacks, that tooltip landed directly on top of
       * the record's name every single time the drawer was opened. Focusing the
       * panel itself keeps the drawer keyboard-reachable without triggering a
       * tooltip the user never asked for.
       */
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        event.currentTarget instanceof HTMLElement && event.currentTarget.focus();
      }}
      tabIndex={-1}
      className={cn(
        "fixed z-50 flex flex-col bg-surface-card shadow-2xl",
        "transition ease-in-out",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:duration-300 data-[state=closed]:duration-200",
        // `h-dvh` rather than `h-full`: on mobile browsers `100%` of the
        // viewport includes the area under the collapsing URL bar, which put
        // the bottom of every drawer — and any footer docked to it — out of
        // reach. `pb-[env(safe-area-inset-bottom)]` keeps it off the iOS home
        // indicator.
        side === "right" && [
          "inset-y-0 right-0 h-dvh w-full sm:max-w-[560px] border-l border-border",
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        ],
        side === "left" && [
          "inset-y-0 left-0 h-dvh w-full sm:max-w-[560px] border-r border-border",
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        ],
        "pb-[env(safe-area-inset-bottom)]",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-lg text-foreground-muted opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-border-ring sm:right-4 sm:top-4 sm:h-9 sm:w-9">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  // `shrink-0` so the header survives when the body below it is a flex child
  // that scrolls; without it a long drawer body squashed the title away.
  <div
    className={cn(
      "flex shrink-0 flex-col gap-1 border-b border-border px-4 py-4 pr-14 sm:px-6 sm:pr-12",
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-foreground-secondary", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
