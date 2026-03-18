"use client";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils/clipboard";

export function CopyRentalTextButton({ text, label = "Copy as text" }: { text: string; label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => copyToClipboard(text)}>
      {label}
    </Button>
  );
}
