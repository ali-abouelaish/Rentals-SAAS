export function slugify(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf(".");
    if (dot === -1) return "jpg";
    const ext = pathname.slice(dot + 1).toLowerCase();
    return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg";
  } catch {
    return "jpg";
  }
}

export function buildImageFilename(
  parts: { postcode?: string | null; unitLabel: string; index: number; url: string }
): string {
  const postcode = slugify(parts.postcode ?? "") || "unit";
  const label = slugify(parts.unitLabel) || "photo";
  const idx = String(parts.index + 1).padStart(2, "0");
  return `${postcode}-${label}-${idx}.${extFromUrl(parts.url)}`;
}

export function buildUnitZipFilename(parts: { postcode?: string | null; unitLabel: string }): string {
  const postcode = slugify(parts.postcode ?? "") || "unit";
  const label = slugify(parts.unitLabel) || "photos";
  return `${postcode}-${label}.zip`;
}
