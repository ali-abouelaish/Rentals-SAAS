"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download, FolderDown } from "lucide-react";
import { buildImageFilename } from "../lib/filename";

export interface LightboxPhoto {
  id: string;
  url: string;
}

interface LightboxProps {
  photos: LightboxPhoto[];
  open: boolean;
  initialIndex: number;
  onClose: () => void;
  postcode: string | null;
  unitLabel: string;
  zipUrl?: string;
}

async function downloadViaBlob(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // CORS or network failure — fall back to opening the raw URL in a new tab.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function Lightbox({ photos, open, initialIndex, onClose, postcode, unitLabel, zipUrl }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const goNext = useCallback(() => {
    setIndex((i) => (photos.length === 0 ? 0 : (i + 1) % photos.length));
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (photos.length === 0 ? 0 : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, goNext, goPrev]);

  if (!open || photos.length === 0) return null;

  const current = photos[index];
  const prevPhoto = photos[(index - 1 + photos.length) % photos.length];
  const nextPhoto = photos[(index + 1) % photos.length];
  const filename = buildImageFilename({ postcode, unitLabel, index, url: current.url });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      if (delta < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); downloadViaBlob(current.url, filename); }}
        aria-label="Download image"
        className="absolute top-4 right-16 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <Download className="h-5 w-5" />
      </button>

      {zipUrl && (
        <a
          href={zipUrl}
          onClick={(e) => e.stopPropagation()}
          aria-label="Download all as zip"
          className="absolute top-4 right-28 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <FolderDown className="h-5 w-5" />
        </a>
      )}

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous image"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next image"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        className="relative flex max-h-[90vh] max-w-[92vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={current.url}
          alt={`Photo ${index + 1} of ${photos.length}`}
          className="max-h-[90vh] max-w-[92vw] object-contain"
          loading="eager"
        />
      </div>

      {photos.length > 1 && (
        <>
          {/* Preload neighbours for instant next/prev */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={prevPhoto.url} alt="" aria-hidden className="hidden" loading="lazy" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={nextPhoto.url} alt="" aria-hidden className="hidden" loading="lazy" />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
