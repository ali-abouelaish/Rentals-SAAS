"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyReferenceButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (http / old browser) — nothing to do, the
      // reference is visible right next to the button.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-foreground-secondary transition-colors hover:bg-surface-inset hover:text-foreground sm:min-h-0 sm:min-w-0 sm:px-2.5"
      title="Copy the payment reference to your clipboard"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-success" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </button>
  );
}
