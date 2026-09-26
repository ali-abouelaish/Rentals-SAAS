import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Two shapes from one component.
 *
 * On a phone this is a bottom sheet: docked to the bottom edge, capped below
 * the viewport height, and scrolled internally. It used to be the centred box
 * below at every width with no height cap and no overflow, so any form taller
 * than the screen was clipped with its submit button somewhere off-screen and
 * no way to scroll to it — which described most of the ~70 dialogs in the app.
 *
 * The scroll lives on an inner wrapper, not on the Content itself, so the close
 * button stays pinned while the form moves under it. That is also why padding
 * moved inward: pass `className="p-0"` here and you will change the shell, not
 * the body.
 *
 * Callers still control width with `max-w-*`; they no longer need to pass
 * `max-h-*` or `overflow-y-auto`.
 */
const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed z-50 flex flex-col border border-border bg-surface-card shadow-xl",
                // Phone — bottom sheet.
                "inset-x-0 bottom-0 mx-auto w-full max-w-lg max-h-[88dvh] rounded-t-2xl",
                "max-md:data-[state=open]:animate-sheet-in",
                // Tablet and up — the centred dialog this has always been.
                "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[85dvh]",
                "md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl",
                "md:data-[state=open]:animate-dialog-in",
                className
            )}
            {...props}
        >
            {/* Grab handle — the affordance that reads "sheet", phone only. */}
            <div
                aria-hidden
                className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-border-strong md:hidden"
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 md:pb-6">
                {children}
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-lg text-foreground-muted opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-border-ring disabled:pointer-events-none md:right-4 md:top-4 md:h-9 md:w-9">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    // `pr-10` keeps a long title clear of the close button in the corner.
    <div
        className={cn("flex flex-col space-y-1.5 mb-4 pr-10", className)}
        {...props}
    />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    // Stacked and full-width on a phone (thumb-sized targets, no ambiguity
    // about which button is primary); inline and right-aligned from `sm`.
    // The `gap-2` matters — stacked buttons used to sit flush against
    // each other because the only spacing was `sm:space-x-2`.
    <div
        className={cn(
            "mt-6 flex flex-col-reverse gap-2",
            "sm:flex-row sm:justify-end",
            "[&>*]:w-full sm:[&>*]:w-auto",
            className
        )}
        {...props}
    />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn("text-xl font-semibold text-foreground font-heading", className)}
        {...props}
    />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-sm text-foreground-secondary", className)}
        {...props}
    />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogTrigger,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
};
