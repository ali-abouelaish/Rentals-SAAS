import { NextRequest, NextResponse } from "next/server";
import { AssertionError, assertSearchAccess } from "@/lib/auth/assertions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSearchQuery } from "@/features/search/data/parser";
import {
  KIND_ORDER,
  kindToHref,
  type SearchResponse,
  type SearchResult,
  type SearchResultKind,
} from "@/features/search/domain/types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const PER_KIND_CAP = 5;

type RpcRow = {
  kind: SearchResultKind;
  id: string;
  parent_id: string | null;
  title: string | null;
  subtitle: string | null;
  rank: number;
};

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await assertSearchAccess();
    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get("q") ?? "";
    const requested = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(requested) ? requested : DEFAULT_LIMIT)
    );

    const tsq = parseSearchQuery(rawQuery);
    if (!tsq) {
      const empty: SearchResponse = {
        query: rawQuery,
        results: [],
        groupedResults: {},
      };
      return NextResponse.json(empty);
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("global_search", {
      q: tsq,
      t: tenantId,
      lim: limit,
    });

    if (error) {
      console.error("[api/search] rpc failed", error);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const rows = (data ?? []) as RpcRow[];
    const results: SearchResult[] = rows
      .filter((row) => row.title && row.title.trim().length > 0)
      .map((row) => ({
        kind: row.kind,
        id: row.id,
        title: row.title!,
        subtitle: row.subtitle?.trim() ? row.subtitle : null,
        href: kindToHref(row.kind, row.id, row.parent_id),
      }));

    const groupedResults: SearchResponse["groupedResults"] = {};
    for (const kind of KIND_ORDER) {
      const slice = results.filter((r) => r.kind === kind).slice(0, PER_KIND_CAP);
      if (slice.length > 0) groupedResults[kind] = slice;
    }

    const payload: SearchResponse = {
      query: rawQuery,
      results,
      groupedResults,
    };
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof AssertionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/search] unexpected", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
