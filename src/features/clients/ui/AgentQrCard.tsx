"use client";

import { QRCodeCanvas } from "qrcode.react";
import { QrCode, Copy, Check } from "lucide-react";
import { useState } from "react";

export function AgentQrCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show a truncated version of the URL for display
  const displayUrl = (() => {
    try {
      const u = new URL(url);
      const path = u.pathname;
      if (path.length > 24) {
        return u.host + path.slice(0, 12) + "…" + path.slice(-10);
      }
      return u.host + path;
    } catch {
      return url.length > 40 ? url.slice(0, 20) + "…" + url.slice(-15) : url;
    }
  })();

  return (
    <div className="flex items-center gap-5 overflow-hidden">
      <div className="shrink-0 p-2 bg-white rounded-xl shadow-sm">
        <QRCodeCanvas value={url} size={88} bgColor="#ffffff" fgColor="#1C2A39" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <QrCode className="h-4 w-4 text-brand shrink-0" strokeWidth={2} />
          <p className="text-sm font-semibold text-foreground">Public Lead Form</p>
        </div>
        <p className="text-xs text-foreground-muted truncate leading-relaxed mb-2" title={url}>
          {displayUrl}
        </p>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand/80 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
