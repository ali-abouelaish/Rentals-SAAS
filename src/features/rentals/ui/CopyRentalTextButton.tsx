"use client";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils/clipboard";

export function CopyRentalTextButton({ text }: { text: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => copyToClipboard(text)}>
      Copy as text
    </Button>
  );
}
