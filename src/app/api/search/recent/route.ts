import { NextResponse } from "next/server";
import { AssertionError, assertSearchAccess } from "@/lib/auth/assertions";
import type { RecentEntity } from "@/features/search/domain/types";

/**
 * v1 stub: recents are stored client-side in localStorage. This route
 * exists so the client can call it unconditionally and we can swap in
 * a server-backed `recent_views` table in v2 without changing callers.
 */
export async function GET() {
  try {
    await assertSearchAccess();
    const empty: RecentEntity[] = [];
    return NextResponse.json(empty);
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
