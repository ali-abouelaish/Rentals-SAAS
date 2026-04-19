"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getRoomBookingLink } from "@/features/booking-forms/actions/booking-link";

interface CopyBookingLinkButtonProps {
  unitId: string;
  size?: "sm" | "md";
}

export function CopyBookingLinkButton({ unitId, size = "sm" }: CopyBookingLinkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    startTransition(async () => {
      const result = await getRoomBookingLink(unitId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
        toast.success("Booking link copied", { description: result.url });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Could not access clipboard");
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size === "sm" ? "sm" : "md"}
      onClick={handleCopy}
      loading={isPending}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 mr-1" />
          Copied
        </>
      ) : (
        <>
          <LinkIcon className="h-3.5 w-3.5 mr-1" />
          Copy booking link
        </>
      )}
    </Button>
  );
}
