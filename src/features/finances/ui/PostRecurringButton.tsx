"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { postRecurringEntries } from "../actions/post-recurring";

type Props = {
  year: number;
  month: number;
  posted: boolean;
  disabled?: boolean;
};

export function PostRecurringButton({ year, month, posted, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const result = await postRecurringEntries({ year, month });
      if ("error" in result) {
        toast.error(result.error);
      } else if (result.inserted === 0 && result.skipped === 0) {
        toast.info("Nothing to post for this month yet.");
      } else if (result.inserted === 0) {
        toast.info(`All ${result.skipped} entries already posted — nothing changed.`);
      } else {
        toast.success(
          `Posted ${result.inserted} new entr${result.inserted === 1 ? "y" : "ies"}${
            result.skipped > 0 ? ` (${result.skipped} already posted)` : ""
          }.`
        );
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  }

  const loading = busy || pending;

  return (
    <Button
      type="button"
      variant={posted ? "outline" : "secondary"}
      size="sm"
      onClick={onClick}
      disabled={loading || disabled}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {posted ? "Re-post recurring entries" : "Post recurring entries"}
    </Button>
  );
}
