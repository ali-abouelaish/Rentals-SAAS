"use client";

import {
  MapPin,
  Calendar,
  Home,
  Users,
  PoundSterling,
  Mail,
  Phone,
  MessageCircle,
  Download,
  Images,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { STATUS_CONFIG } from "@/features/properties/domain/types";
import type { UnitStatus } from "@/features/properties/domain/types";
import type { PublicShareUnit } from "../data/public";
import { formatPriceRange, unitLabel } from "./format";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface UnitInfoDrawerProps {
  unit: PublicShareUnit | null;
  commissionPct: number;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenGallery?: () => void;
}

function availabilityText(unit: PublicShareUnit): string {
  if (unit.notice_given && unit.available_date) {
    return `Available from ${DATE_FMT.format(new Date(unit.available_date))}`;
  }
  if (unit.status === "available") {
    if (unit.available_date && new Date(unit.available_date).getTime() > Date.now()) {
      return `Available from ${DATE_FMT.format(new Date(unit.available_date))}`;
    }
    return "Available now";
  }
  const cfg = STATUS_CONFIG[unit.status as UnitStatus];
  return cfg?.label ?? unit.status;
}

export function UnitInfoDrawer({
  unit,
  commissionPct,
  token,
  open,
  onOpenChange,
  onOpenGallery,
}: UnitInfoDrawerProps) {
  if (!unit) return null;

  const hero = unit.photos[0]?.url || null;
  const hasPhotos = unit.photos.length > 0;
  const fullAddress = [unit.property.address_line_1, unit.property.address_line_2]
    .filter(Boolean)
    .join(", ");
  const priceRange = formatPriceRange(unit.min_price_pcm, unit.max_price_pcm);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>{unit.property.name}</SheetTitle>
          <SheetDescription>{unitLabel(unit)}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {hero && (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenGallery?.();
              }}
              className="relative block w-full aspect-[16/9] bg-surface-inset overflow-hidden group"
              aria-label="Open photo gallery"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero}
                alt={`${unit.property.name} - ${unitLabel(unit)}`}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
              {unit.photos.length > 1 && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
                  <Images className="h-3 w-3" />
                  View {unit.photos.length} photos
                </span>
              )}
            </button>
          )}

          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm text-foreground-secondary">
              <MapPin className="h-4 w-4 shrink-0 text-foreground-muted" />
              <span>
                {fullAddress}
                {unit.property.postcode ? ` · ${unit.property.postcode}` : ""}
                {unit.property.area ? ` · ${unit.property.area}` : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InfoBox
                icon={<PoundSterling className="h-4 w-4" />}
                label="Rent pcm"
                value={priceRange}
              />
              <InfoBox
                icon={<Calendar className="h-4 w-4" />}
                label="Availability"
                value={availabilityText(unit)}
              />
              <InfoBox
                icon={<Home className="h-4 w-4" />}
                label="Type"
                value={unitLabel(unit)}
              />
              <InfoBox
                icon={<Users className="h-4 w-4" />}
                label="Couples"
                value={
                  unit.couples_allowed
                    ? unit.couples_price_pcm
                      ? `£${unit.couples_price_pcm.toLocaleString("en-GB")} pcm`
                      : "Allowed"
                    : "Not allowed"
                }
              />
            </div>

            <div className="rounded-xl border border-border bg-surface-inset px-4 py-3 text-sm">
              <span className="text-foreground-muted">Commission: </span>
              <span className="font-medium text-foreground">{commissionPct}%</span>
            </div>

            {unit.contact && (
              <div className="rounded-xl border border-border bg-surface-card p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  Contact
                </h3>
                <p className="text-sm font-medium text-foreground">{unit.contact.full_name}</p>
                <div className="flex flex-wrap gap-2">
                  {unit.contact.phone && (
                    <a
                      href={`tel:${unit.contact.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-inset"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call
                    </a>
                  )}
                  {unit.contact.email && (
                    <a
                      href={`mailto:${unit.contact.email}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-inset"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </a>
                  )}
                  {(unit.contact.whatsapp_number ?? unit.contact.phone) && (
                    <a
                      href={`https://wa.me/${(unit.contact.whatsapp_number ?? unit.contact.phone ?? "").replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-inset"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}

            {(unit.notes || unit.property.notes) && (
              <div className="rounded-xl border border-border bg-surface-card p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  Notes
                </h3>
                {unit.notes && (
                  <p className="whitespace-pre-wrap text-sm text-foreground">{unit.notes}</p>
                )}
                {unit.property.notes && (
                  <p className="whitespace-pre-wrap text-sm text-foreground-secondary">
                    <span className="font-medium">Property:</span> {unit.property.notes}
                  </p>
                )}
              </div>
            )}

            {hasPhotos && (
              <a
                href={`/api/shares/${encodeURIComponent(token)}/units/${unit.id}/images.zip`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-inset"
              >
                <Download className="h-4 w-4" />
                Download all photos ({unit.photos.length})
              </a>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
