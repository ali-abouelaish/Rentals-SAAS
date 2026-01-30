"use client";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils/clipboard";

export function CopyProfileButton({ text }: { text: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => copyToClipboard(text)}
    >
      Copy Profile
    </Button>
  );
}
