import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicShareByToken } from "@/features/property-shares/data/public";
import { deriveShareStatus } from "@/features/property-shares/domain/types";
import { clientIpFromHeaders, rateLimitCheck } from "@/features/property-shares/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashIp(ip: string): string {
  const baseSalt = process.env.IP_HASH_BASE_SALT ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const dailySalt = createHash("sha256").update(baseSalt + day).digest("hex");
  return createHash("sha256").update(ip + dailySalt).digest("hex");
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const ip = clientIpFromHeaders(req);
  const limit = rateLimitCheck(`track:${ip}`, 60_000, 30);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const share = await getPublicShareByToken(params.token);
  if (!share) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const status = deriveShareStatus(share);
  if (status !== "active") {
    return NextResponse.json({ error: "inactive" }, { status: 410 });
  }

  const userAgent = req.headers.get("user-agent");
  const ipHash = hashIp(ip);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("share_views").insert({
    share_id: share.id,
    ip_hash: ipHash,
    user_agent: userAgent ? userAgent.slice(0, 500) : null,
  });

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
