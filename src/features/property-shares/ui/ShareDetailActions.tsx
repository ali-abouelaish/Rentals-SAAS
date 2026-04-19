"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Download,
  Ban,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { revokeShareAction } from "../actions/shares";

interface ShareDetailActionsProps {
  shareId: string;
  shareUrl: string;
  shareName: string;
  revoked: boolean;
}

export function ShareDetailActions({
  shareId,
  shareUrl,
  shareName,
  revoked,
}: ShareDetailActionsProps) {
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeShareAction(shareId);
      if (!result.ok) setError(result.error);
      setConfirmRevoke(false);
    });
  }

  function handleDownloadQr() {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `share-qr-${shareName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const whatsappText = encodeURIComponent(`${shareName}\n${shareUrl}`);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Public link</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground"
          />
          <Button
            type="button"
            onClick={handleCopy}
            variant="outline"
            size="md"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button asChild variant="outline" size="md">
            <a href={shareUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="h-4 w-4" />
              Open
            </a>
          </Button>
          <Button asChild variant="outline" size="md">
            <a
              href={`https://wa.me/?text=${whatsappText}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">QR code</h2>
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div ref={canvasWrapRef} className="rounded-lg border border-border bg-white p-3">
            <QRCodeCanvas value={shareUrl} size={160} level="M" includeMargin={false} />
          </div>
          <Button type="button" onClick={handleDownloadQr} variant="outline" size="md">
            <Download className="h-4 w-4" />
            Download PNG
          </Button>
        </div>
      </div>

      {!revoked && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-error">Revoke share</h2>
          <p className="mt-1 text-xs text-foreground-secondary">
            Permanently disables this link. Viewers will see an inactive page. This cannot be undone.
          </p>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-3">
            {confirmRevoke ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleRevoke}
                  disabled={pending}
                  variant="destructive"
                  loading={pending}
                >
                  <Ban className="h-4 w-4" />
                  {pending ? "Revoking" : "Yes, revoke permanently"}
                </Button>
                <Button
                  type="button"
                  onClick={() => setConfirmRevoke(false)}
                  disabled={pending}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                variant="destructive"
              >
                <Ban className="h-4 w-4" />
                Revoke link
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
