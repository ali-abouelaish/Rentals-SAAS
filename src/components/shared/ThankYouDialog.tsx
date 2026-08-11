"use client";

import type { CSSProperties, ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Confirmation popup shown after a public form is submitted — demo requests,
 * business-card enquiries and lead registrations all land here.
 *
 * Styled from the global tokens in globals.css rather than any surface's own
 * stylesheet, because Radix portals the content to document.body: scoped CSS
 * (e.g. the landing's `.harbor-landing` tree) does not reach it. Surfaces that
 * need to stay on-brand pass `contentStyle` to override the type stack.
 */
export function ThankYouDialog({
  open,
  onOpenChange,
  title = "Thank you",
  message,
  footnote,
  actionLabel = "Close",
  actionClassName,
  contentStyle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: ReactNode;
  footnote?: ReactNode;
  actionLabel?: string;
  /**
   * Overrides the dismiss button's styling. Tenant surfaces leave this unset
   * so the button stays on the agency's secondary colour; the Harbor Ops
   * marketing site passes its monochrome treatment instead, since nothing
   * there is tenant-branded.
   */
  actionClassName?: string;
  contentStyle?: CSSProperties;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-center" style={contentStyle}>
        <div className="flex flex-col items-center px-2 pt-2 pb-1">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
            <CheckCircle2 className="h-9 w-9 text-success" strokeWidth={2} />
          </div>

          <DialogTitle className="text-2xl">{title}</DialogTitle>

          <DialogDescription className="mt-2 max-w-sm text-base leading-relaxed">
            {message}
          </DialogDescription>

          {footnote ? (
            <p className="mt-2 text-sm text-foreground-muted">{footnote}</p>
          ) : null}

          <Button
            variant="secondary"
            className={cn("mt-6 w-full", actionClassName)}
            onClick={() => onOpenChange(false)}
          >
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
