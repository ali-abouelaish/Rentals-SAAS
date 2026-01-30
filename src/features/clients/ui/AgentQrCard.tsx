"use client";

import { QRCodeCanvas } from "qrcode.react";

export function AgentQrCard({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-muted bg-card p-4 shadow-soft">
      <QRCodeCanvas value={url} size={120} bgColor="#ffffff" fgColor="#1C2A39" />
      <div>
        <p className="text-sm font-medium text-navy">Public Lead Form</p>
        <p className="text-xs text-gray-500 break-all">{url}</p>
      </div>
    </div>
  );
}
