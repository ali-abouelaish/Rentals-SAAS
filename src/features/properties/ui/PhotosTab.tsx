"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { saveUnitPhoto, deleteUnitPhoto } from "../actions/photos";
import type { Unit, UnitPhoto } from "../domain/types";

const CATEGORY_LABELS: Record<string, string> = {
  room: "Room",
  bathroom: "Bathroom",
  kitchen: "Kitchen",
  exterior: "Exterior",
  garden: "Garden",
  communal: "Communal",
  wc: "WC",
};

// Only this many photos are fetched per section up front; the rest load on demand.
const PREVIEW_LIMIT = 3;

interface PhotosTabProps {
  unit: Unit;
}

function photoQuery(unitId: string | null, propertyId: string) {
  const supabase = createSupabaseBrowserClient();
  let q = supabase.from("unit_photos").select("*", { count: "exact" });
  q = unitId ? q.eq("unit_id", unitId) : q.eq("property_id", propertyId).is("unit_id", null);
  return q.order("sort_order", { ascending: true }).order("created_at", { ascending: true });
}

export function PhotosTab({ unit }: PhotosTabProps) {
  const [roomPhotos, setRoomPhotos] = useState<UnitPhoto[]>([]);
  const [propertyPhotos, setPropertyPhotos] = useState<UnitPhoto[]>([]);
  const [roomCount, setRoomCount] = useState(0);
  const [propertyCount, setPropertyCount] = useState(0);
  const [roomExpanded, setRoomExpanded] = useState(false);
  const [propertyExpanded, setPropertyExpanded] = useState(false);
  const [expanding, setExpanding] = useState<"room" | "property" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRoomExpanded(false);
    setPropertyExpanded(false);
    try {
      const [roomRes, propRes] = await Promise.all([
        photoQuery(unit.id, unit.property_id).limit(PREVIEW_LIMIT),
        photoQuery(null, unit.property_id).limit(PREVIEW_LIMIT),
      ]);
      if (roomRes.error) throw new Error(roomRes.error.message);
      if (propRes.error) throw new Error(propRes.error.message);
      setRoomPhotos((roomRes.data ?? []) as UnitPhoto[]);
      setPropertyPhotos((propRes.data ?? []) as UnitPhoto[]);
      setRoomCount(roomRes.count ?? roomRes.data?.length ?? 0);
      setPropertyCount(propRes.count ?? propRes.data?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load photos");
    } finally {
      setLoading(false);
    }
  }, [unit.id, unit.property_id]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const showAll = async (section: "room" | "property") => {
    setExpanding(section);
    try {
      const res = await photoQuery(section === "room" ? unit.id : null, unit.property_id);
      if (res.error) throw new Error(res.error.message);
      const rows = (res.data ?? []) as UnitPhoto[];
      if (section === "room") {
        setRoomPhotos(rows);
        setRoomExpanded(true);
      } else {
        setPropertyPhotos(rows);
        setPropertyExpanded(true);
      }
    } catch {
      toast.error("Failed to load all photos");
    } finally {
      setExpanding(null);
    }
  };

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${unit.tenant_id}/${unit.property_id}/units/${unit.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("property_photos")
          .upload(path, file);
        if (uploadError) {
          toast.error("Failed to upload photo", { description: uploadError.message });
          continue;
        }
        const { data: urlData } = supabase.storage.from("property_photos").getPublicUrl(path);
        try {
          const saved = await saveUnitPhoto({
            url: urlData.publicUrl,
            category: "room",
            unit_id: unit.id,
            property_id: unit.property_id,
          });
          // Only surface the new photo immediately when the list is fully visible.
          setRoomCount((c) => c + 1);
          setRoomPhotos((prev) =>
            roomExpanded || prev.length < PREVIEW_LIMIT ? [...prev, saved] : prev,
          );
        } catch {
          toast.error("Failed to save photo record");
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (photo: UnitPhoto) => {
    try {
      await deleteUnitPhoto(photo.id);
      setRoomPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setRoomCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error("Failed to delete photo");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-foreground-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-surface-inset p-6 text-center my-4">
        <p className="text-sm text-foreground mb-2">Couldn&apos;t load photos</p>
        <p className="text-xs text-foreground-secondary mb-3">{error}</p>
        <button
          type="button"
          onClick={loadPhotos}
          className="rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const moreRoom = roomCount - roomPhotos.length;
  const moreProperty = propertyCount - propertyPhotos.length;

  return (
    <div className="space-y-6 py-1">
      {/* Unit-level photos */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">
          Room Photos {roomCount > 0 && `(${roomCount})`}
        </h3>
        {roomPhotos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-inset p-8 text-center">
            <ImageIcon className="h-10 w-10 text-foreground-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No photos yet</p>
            <p className="text-xs text-foreground-secondary mb-4">
              Upload photos of this unit. Supported: JPG, PNG, WebP.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3">
            {roomPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border border-border group"
              >
                <a href={photo.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Room photo" loading="lazy" className="h-full w-full object-cover" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(photo)}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {!roomExpanded && moreRoom > 0 && (
              <button
                type="button"
                onClick={() => showAll("room")}
                disabled={expanding === "room"}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-inset text-xs font-medium text-foreground-muted hover:border-brand/40 hover:text-brand transition-colors"
              >
                {expanding === "room" ? <Loader2 className="h-4 w-4 animate-spin" /> : `+${moreRoom} more`}
              </button>
            )}
          </div>
        )}
        <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-border bg-surface-card px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : "Upload photos"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files?.length) handleUpload(e.target.files);
            }}
          />
        </label>
      </section>

      {/* Property-level photos — read-only reference */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">
          Property Photos {propertyCount > 0 && `(${propertyCount})`}
        </h3>
        {propertyPhotos.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-inset p-4 text-center">
            <ImageIcon className="h-8 w-8 text-foreground-muted mx-auto mb-2" />
            <p className="text-xs text-foreground-secondary">
              Property-level communal photos (exterior, kitchen, bathrooms) will appear here once uploaded.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {propertyPhotos.map((photo) => (
              <div key={photo.id} className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border border-border">
                <a href={photo.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={CATEGORY_LABELS[photo.category] ?? "Property photo"} loading="lazy" className="h-full w-full object-cover" />
                </a>
                <span className="absolute bottom-0 inset-x-0 bg-black/55 px-1 py-0.5 text-[10px] leading-tight text-white text-center truncate">
                  {CATEGORY_LABELS[photo.category] ?? photo.category}
                </span>
              </div>
            ))}
            {!propertyExpanded && moreProperty > 0 && (
              <button
                type="button"
                onClick={() => showAll("property")}
                disabled={expanding === "property"}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-inset text-xs font-medium text-foreground-muted hover:border-brand/40 hover:text-brand transition-colors"
              >
                {expanding === "property" ? <Loader2 className="h-4 w-4 animate-spin" /> : `+${moreProperty} more`}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
