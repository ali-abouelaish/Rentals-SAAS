import { Megaphone } from "lucide-react";

export function MarketingTab() {
  return (
    <div className="py-12 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
        <Megaphone className="h-7 w-7 text-brand" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-2">Marketing Export Coming Soon</h3>
      <p className="text-xs text-foreground-secondary max-w-[280px] mx-auto leading-relaxed">
        Your listing will be auto-generated from room and property data for SpareRoom and other platforms.
        This feature is currently in development.
      </p>
    </div>
  );
}
