"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { motion } from "framer-motion";
import { CreditCard, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BusinessCardModalProps {
  agentId: string;
  cardUrl: string;
}

function truncateUrl(url: string): string {
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
}

export function BusinessCardModal({ cardUrl }: BusinessCardModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cardUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <CreditCard className="h-4 w-4" />
          My Business Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Your Business Card</DialogTitle>
        </DialogHeader>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-col items-center gap-5 pt-2"
        >
          {/* QR Code */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border/40">
            <QRCodeCanvas
              value={cardUrl}
              size={220}
              bgColor="#ffffff"
              fgColor="#1C2A39"
            />
          </div>

          {/* URL + actions */}
          <div className="w-full space-y-3">
            <p className="text-center text-xs text-foreground-muted truncate" title={cardUrl}>
              {truncateUrl(cardUrl)}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-inset"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a
                href={cardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-inset"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open card
              </a>
            </div>
          </div>

          <p className="text-center text-[11px] text-foreground-muted">
            Share this QR code or link with clients so they can view your profile.
          </p>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
