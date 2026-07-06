import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import archiver from "archiver";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deriveShareStatus } from "@/features/property-shares/domain/types";
import type { PropertyShare } from "@/features/property-shares/domain/types";
import { buildImageFilename, buildUnitZipFilename } from "@/features/property-shares/lib/filename";
import { rateLimitCheck, clientIpFromHeaders } from "@/features/property-shares/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const MAX_ZIP_DOWNLOADS_PER_HOUR = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string; unitId: string } }
) {
  const ip = clientIpFromHeaders(request);
  const rl = rateLimitCheck(`zip:${ip}`, HOUR_MS, MAX_ZIP_DOWNLOADS_PER_HOUR);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } }
    );
  }

  const supabase = createSupabaseAdminClient();

  const { data: shareRow } = await supabase
    .from("property_shares")
    .select("*")
    .eq("token", params.token)
    .maybeSingle();

  if (!shareRow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const share = shareRow as PropertyShare;

  const status = deriveShareStatus(share);
  if (status !== "active") {
    return NextResponse.json({ error: status }, { status: 410 });
  }

  const { data: unit } = await supabase
    .from("units")
    .select("id, tenant_id, status, unit_type, room_number, room_type, property_id, property:properties!inner(id, name, postcode)")
    .eq("id", params.unitId)
    .eq("tenant_id", share.tenant_id)
    .maybeSingle();

  if (!unit) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!share.availability_statuses.includes(unit.status as PropertyShare["availability_statuses"][number])) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const property = (unit as any).property as { id: string; name: string; postcode: string | null };

  const { data: photoRows } = await supabase
    .from("unit_photos")
    .select("id, url, sort_order, unit_id, property_id")
    .eq("tenant_id", share.tenant_id)
    .or(`unit_id.eq.${unit.id},property_id.eq.${property.id}`)
    .order("sort_order", { ascending: true });

  const photos = (photoRows ?? []).sort((a: any, b: any) => {
    // unit photos first, then property photos
    const aIsUnit = a.unit_id === unit.id ? 0 : 1;
    const bIsUnit = b.unit_id === unit.id ? 0 : 1;
    if (aIsUnit !== bIsUnit) return aIsUnit - bIsUnit;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  if (photos.length === 0) {
    return NextResponse.json({ error: "no_images" }, { status: 404 });
  }

  const unitLabelForFile =
    unit.unit_type === "whole_flat"
      ? "whole-flat"
      : unit.unit_type === "studio"
      ? "studio"
      : unit.room_number
      ? `room-${unit.room_number}`
      : "room";
  const labelForFile = `${property.name}-${unitLabelForFile}`;
  const zipFilename = buildUnitZipFilename({ postcode: property.postcode, unitLabel: labelForFile });

  // Only fetch images from our own Supabase storage origin. photo.url is
  // attacker-influenceable (saveUnitPhoto stores whatever URL it is given), and
  // this route fetches it server-side — an arbitrary URL here would be an SSRF
  // vector into internal/metadata endpoints. Restrict to https on the Supabase
  // project host; anything else is skipped.
  const storageOrigin = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
    } catch {
      return null;
    }
  })();
  const isAllowedPhotoUrl = (raw: string): boolean => {
    if (!storageOrigin) return false;
    try {
      const u = new URL(raw);
      return u.protocol === "https:" && u.origin === storageOrigin;
    } catch {
      return false;
    }
  };

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err) => {
    // archiver will abort the stream; the client sees a truncated download.
    // eslint-disable-next-line no-console
    console.error("[shares zip] archive error", err);
  });

  // Append each image as a streamed entry.
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    if (!isAllowedPhotoUrl(photo.url)) continue;
    const res = await fetch(photo.url);
    if (!res.ok || !res.body) continue;
    const nodeStream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
    const entryName = buildImageFilename({
      postcode: property.postcode,
      unitLabel: labelForFile,
      index: i,
      url: photo.url,
    });
    archive.append(nodeStream, { name: entryName });
  }

  archive.finalize();

  const webStream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${zipFilename}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
