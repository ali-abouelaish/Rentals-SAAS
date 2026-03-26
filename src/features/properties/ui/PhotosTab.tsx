"use client";

import { ImageIcon } from "lucide-react";
import type { Unit } from "../domain/types";

const CATEGORY_LABELS: Record<string, string> = {
  room: "Room",
  bathroom: "Bathroom",
  kitchen: "Kitchen",
  exterior: "Exterior",
  garden: "Garden",
  communal: "Communal",
  wc: "WC",
};

interface PhotosTabProps {
  unit: Unit;
}

export function PhotosTab({ unit }: PhotosTabProps) {
  return (
    <div className="space-y-6 py-1">
      {/* Property-level photos — read-only reference */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">
          Property Photos
        </h3>
        <div className="rounded-lg border border-border bg-surface-inset p-4 text-center">
          <ImageIcon className="h-8 w-8 text-foreground-muted mx-auto mb-2" />
          <p className="text-xs text-foreground-secondary">
            Property-level communal photos (exterior, kitchen, bathrooms) will appear here once uploaded.
          </p>
        </div>
      </section>

      {/* Unit-level photos */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">
          Room Photos
        </h3>
        <div className="rounded-lg border border-dashed border-border bg-surface-inset p-8 text-center">
          <ImageIcon className="h-10 w-10 text-foreground-muted mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No photos yet</p>
          <p className="text-xs text-foreground-secondary mb-4">
            Upload photos of this unit. Supported: JPG, PNG, WebP.
          </p>
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-border bg-surface-card px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors">
            <ImageIcon className="h-3.5 w-3.5" />
            Upload photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={() => {
                // Photo upload to be wired to Supabase Storage
              }}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
