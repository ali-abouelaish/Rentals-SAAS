"use client";

import { useMemo, useState } from "react";
import { ExternalLink, ImageOff, Images, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FIELD_GROUPS, LISTING_FIELDS } from "../domain/fields";

/**
 * Full detail view for a scraped listing, for rows that have no advert link to
 * open. Spreadsheet-imported listings usually have no public advert, so without
 * this their data is only visible in the database.
 */

/** `select *` from scraped_listings — deliberately loose. */
type Listing = Record<string, unknown> & { id: string };

/** Fields shown in the drawer's own header, so the grid doesn't repeat them. */
const HEADER_FIELDS = new Set(["title", "location", "price", "status", "available_date", "room_label"]);
/** Rendered as the gallery rather than as text rows. */
const MEDIA_FIELDS = new Set(["first_photo_url", "all_photos", "drive_folder_url"]);

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function isAbsoluteUrl(value: unknown): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/**
 * Photo URLs, in the same precedence the importer writes them: the JSON array
 * first, then the comma-joined list, then the single thumbnail.
 */
function photoUrls(listing: Listing): string[] {
  const raw = listing.photos;
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(isAbsoluteUrl);
    } catch {
      // Fall through to the other columns.
    }
  }
  if (Array.isArray(raw)) return raw.filter(isAbsoluteUrl);

  const all = text(listing.all_photos);
  if (all) {
    const parts = all.split(/[,\n]/).map((p) => p.trim()).filter(isAbsoluteUrl);
    if (parts.length > 0) return parts;
  }

  const first = listing.first_photo_url;
  return isAbsoluteUrl(first) ? [first as string] : [];
}

/** Drive images occasionally 404; a broken tile is worse than no tile. */
function Photo({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-lg border border-border bg-surface-inset"
      title="Open the full-size image in a new tab"
    >
      {/* Plain <img>: these are third-party hosts (Drive), which next/image
          would reject without a remotePatterns entry per host. */}
      <img
        src={url}
        alt={`Listing photo ${index + 1}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-28 w-full object-cover transition-transform duration-200 group-hover:scale-105"
      />
    </a>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-xs text-foreground-muted sm:w-44 sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function ListingDetailsDrawer({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);

  const photos = useMemo(() => photoUrls(listing), [listing]);

  // Catalogue-driven so the drawer stays in step with the mapping screen: any
  // field added there shows up here automatically.
  const groups = useMemo(
    () =>
      FIELD_GROUPS.map((group) => ({
        group,
        fields: LISTING_FIELDS.filter(
          (field) =>
            field.group === group &&
            !HEADER_FIELDS.has(field.key) &&
            !MEDIA_FIELDS.has(field.key) &&
            text(listing[field.key]) !== null
        ),
      })).filter((entry) => entry.fields.length > 0),
    [listing]
  );

  const rawRow = useMemo(() => {
    const raw = listing.raw_row;
    if (!raw) return null;
    if (typeof raw === "object") return raw as Record<string, unknown>;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }, [listing]);

  const title = text(listing.title) ?? text(listing.room_label) ?? text(listing.location) ?? "Listing";
  const price = listing.price != null ? `£${Number(listing.price).toLocaleString("en-GB")}` : null;
  const driveFolder = listing.drive_folder_url;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        title="No advert link for this listing — open everything we hold for it, including photos."
      >
        <PanelRightOpen className="h-3.5 w-3.5" />
        Details
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {text(listing.location) ?? "No address recorded"}
              {text(listing.source) === "spreadsheet" ? " · imported from spreadsheet" : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 pb-8">
            {/* ── Headline facts ─────────────────────────── */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border bg-surface-inset p-4">
              <div>
                <dt className="text-xs text-foreground-muted">Price</dt>
                <dd className="text-sm font-medium text-foreground">{price ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-foreground-muted">Status</dt>
                <dd className="text-sm font-medium text-foreground">{text(listing.status) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-foreground-muted">Room</dt>
                <dd className="text-sm font-medium text-foreground">
                  {text(listing.room_label) ?? text(listing.property_type) ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-foreground-muted">Available</dt>
                <dd className="text-sm font-medium text-foreground">
                  {text(listing.available_date) ?? "—"}
                </dd>
              </div>
            </dl>

            {/* ── Photos ─────────────────────────────────── */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Images className="h-4 w-4" />
                  Photos {photos.length > 0 && <span className="text-foreground-muted">({photos.length})</span>}
                </h3>
                {isAbsoluteUrl(driveFolder) && (
                  <a
                    href={driveFolder as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-foreground-link hover:underline"
                    title="Open this property's Drive folder"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Drive folder
                  </a>
                )}
              </div>

              {photos.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((url, i) => (
                      <Photo key={url} url={url} index={i} />
                    ))}
                  </div>
                  {text(listing.drive_room_folder) && (
                    <p className="text-xs text-foreground-muted">
                      Room photos from the “{text(listing.drive_room_folder)}” folder, plus communal
                      areas.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-foreground-muted">
                  <ImageOff className="h-4 w-4 shrink-0" />
                  <span>
                    {isAbsoluteUrl(driveFolder)
                      ? "No photos imported from the Drive folder yet — run the import from the spreadsheet panel."
                      : "No photos for this listing. Map a Google Drive photo folder column to import them."}
                  </span>
                </div>
              )}
            </section>

            {/* ── Description ────────────────────────────── */}
            {text(listing.description) && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Description</h3>
                <p className="whitespace-pre-wrap text-sm text-foreground-secondary">
                  {text(listing.description)}
                </p>
              </section>
            )}

            {/* ── Everything else we hold ────────────────── */}
            {groups.map(({ group, fields }) => (
              <section key={group} className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{group}</h3>
                <dl>
                  {fields.map((field) => {
                    const value = listing[field.key];
                    return (
                      <Row key={field.key} label={field.label}>
                        {isAbsoluteUrl(value) ? (
                          <a
                            href={value as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground-link hover:underline"
                          >
                            {String(value)}
                          </a>
                        ) : (
                          text(value)
                        )}
                      </Row>
                    );
                  })}
                </dl>
              </section>
            ))}

            {/* ── Provenance ─────────────────────────────── */}
            <section className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Record</h3>
              <dl>
                <Row label="Source">
                  {text(listing.source) === "spreadsheet" ? "Spreadsheet import" : "SpareRoom scraper"}
                </Row>
                {text(listing.external_ref) && (
                  <Row label="Row identity">
                    <code className="break-all text-xs">{text(listing.external_ref)}</code>
                  </Row>
                )}
                {text(listing.last_seen_at) && (
                  <Row label="Last seen in sheet">
                    {new Date(String(listing.last_seen_at)).toLocaleString("en-GB")}
                  </Row>
                )}
                {text(listing.updated_at) && (
                  <Row label="Updated">
                    {new Date(String(listing.updated_at)).toLocaleString("en-GB")}
                  </Row>
                )}
              </dl>
            </section>

            {/* ── The untouched source row ───────────────── */}
            {rawRow && (
              <details className="rounded-xl border border-border bg-surface-inset p-4">
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Original spreadsheet row
                </summary>
                <p className="mt-1 text-xs text-foreground-muted">
                  Exactly as it appeared in the sheet — useful for checking a column mapping.
                </p>
                <dl className="mt-2">
                  {Object.entries(rawRow).map(([key, value]) => (
                    <Row key={key} label={key}>
                      {text(value) ?? <span className="text-foreground-muted">(empty)</span>}
                    </Row>
                  ))}
                </dl>
              </details>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
