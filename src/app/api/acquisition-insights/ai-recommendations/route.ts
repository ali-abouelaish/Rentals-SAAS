import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RoomConfig, ComparableProperty, PropertyType, RoomType } from "@/features/acquisition-insights/domain/types";

export const runtime = "nodejs";

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set on the server.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

type RequestBody = {
  evaluationId?: string;
  address: string;
  postcode?: string;
  detected_area: string;
  property_type: PropertyType;
  total_rooms: number;
  rooms: RoomConfig[];
};

type MarketListing = {
  url: string;
  title: string | null;
  location_text: string | null;
  property_type: string | null;
  price: number | null;
  room_count: number | null;
  min_room_price_pcm: number | null;
  max_room_price_pcm: number | null;
  latitude: number | null;
  longitude: number | null;
  distance_miles: number | null;
  scraped_at: string;
};

type MarketSummary = {
  count: number;
  median_rent_pounds: number | null;
  min_rent_pounds: number | null;
  max_rent_pounds: number | null;
  last_scraped_at: string | null;
  listings: MarketListing[];
};

type AIResponse = {
  recommended_rents: {
    room_type: RoomType;
    recommended_rent_pcm: number;
    reasoning: string;
  }[];
  recommended_occupancy: number;
  occupancy_reasoning: string;
  comparable_properties_used: ComparableProperty[];
  risk_flags: { severity: "warning" | "info"; message: string }[];
};

const MARKET_FRESHNESS_DAYS = 14;
const MARKET_DEFAULT_RADIUS_MILES = 2;
const EARTH_RADIUS_MILES = 3958.8;

function normalizePostcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toUpperCase().replace(/\s+/g, " ") || null;
}

function extractPostcodeOutward(postcode: string): string {
  // "E1 0LD" -> "E1"; "E14AA" -> "E14A" (best-effort if no space). For the
  // cache lookup we only care about the part before the space when present.
  const space = postcode.indexOf(" ");
  if (space > 0) return postcode.slice(0, space);
  // No space — match standard UK outward pattern (1-2 letters + 1 digit + optional letter/digit).
  const m = postcode.match(/^([A-Z]{1,2}[0-9][A-Z0-9]?)/);
  return m ? m[1] : postcode;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function geocodePostcode(
  postcode: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { latitude?: number; longitude?: number };
    };
    if (data.result?.latitude != null && data.result?.longitude != null) {
      return { latitude: data.result.latitude, longitude: data.result.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Server missing OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { address, postcode, detected_area, property_type, total_rooms, rooms } = body;
  const normalizedPostcode = normalizePostcode(postcode);

  // ── 1. Fetch comparable portfolio data from DB ──────────────
  let comparableData: ComparableProperty[] = [];
  let usedAdjacentArea = false;
  let adjacentAreaName = "";

  try {
    const supabase = createSupabaseServerClient();

    // Query properties in the same area with the same type and similar room count
    const { data: properties } = await supabase
      .from("properties")
      .select(`
        id, name, area, property_type, total_rooms,
        units(id, status, min_price_pcm, max_price_pcm, pm_tenant_id)
      `)
      .eq("property_type", property_type)
      .eq("area", detected_area);

    if (properties && properties.length > 0) {
      comparableData = properties.map((p) => {
        const units = (p.units as { min_price_pcm?: number; max_price_pcm?: number; status?: string }[]) ?? [];
        const occupiedUnits = units.filter((u) => u.status === "occupied").length;
        const totalUnits = units.length || 1;
        const avgRent =
          units
            .filter((u) => u.min_price_pcm)
            .reduce((s, u) => s + (u.min_price_pcm ?? 0), 0) /
          Math.max(units.filter((u) => u.min_price_pcm).length, 1);

        return {
          area: p.area ?? detected_area,
          room_count: p.total_rooms ?? total_rooms,
          property_type: p.property_type as PropertyType,
          avg_rent_pcm: Math.round(avgRent),
          avg_occupancy_rate: Math.round((occupiedUnits / totalUnits) * 100) / 100,
          avg_vacancy_days: 14,
        };
      });
    }

    // If no exact match, try adjacent areas
    if (comparableData.length === 0) {
      usedAdjacentArea = true;
      const { data: adjacentProperties } = await supabase
        .from("properties")
        .select(`id, name, area, property_type, total_rooms, units(id, status, min_price_pcm)`)
        .eq("property_type", property_type)
        .limit(3);

      if (adjacentProperties && adjacentProperties.length > 0) {
        adjacentAreaName = adjacentProperties[0].area ?? "another area";
        comparableData = adjacentProperties.map((p) => {
          const units = (p.units as { min_price_pcm?: number; status?: string }[]) ?? [];
          const avgRent =
            units.filter((u) => u.min_price_pcm).reduce((s, u) => s + (u.min_price_pcm ?? 0), 0) /
            Math.max(units.filter((u) => u.min_price_pcm).length, 1);

          return {
            area: p.area ?? "Portfolio",
            room_count: p.total_rooms ?? total_rooms,
            property_type: p.property_type as PropertyType,
            avg_rent_pcm: Math.round(avgRent),
            avg_occupancy_rate: 0.87,
            avg_vacancy_days: 16,
          };
        });
      }
    }
  } catch {
    // DB unavailable — AI will work with empty comparables and flag it
  }

  // ── 1b. Fetch SpareRoom market listings near the input postcode ─────
  let marketSummary: MarketSummary = {
    count: 0,
    median_rent_pounds: null,
    min_rent_pounds: null,
    max_rent_pounds: null,
    last_scraped_at: null,
    listings: [],
  };

  if (normalizedPostcode) {
    try {
      const supabase = createSupabaseServerClient();
      const sinceIso = new Date(Date.now() - MARKET_FRESHNESS_DAYS * 24 * 60 * 60 * 1000).toISOString();
      // Match the cache on postcode outward (e.g. "E1") so listings scraped
      // under any "E1 *" search become reusable for any "E1 *" evaluation.
      const outward = extractPostcodeOutward(normalizedPostcode);
      const { data: marketRows } = await supabase
        .from("market_listings")
        .select(
          "url, title, location_text, property_type, price, room_count, min_room_price_pcm, max_room_price_pcm, latitude, longitude, scraped_at"
        )
        .or(`postcode_searched.eq.${outward},postcode_searched.like.${outward} %`)
        .gte("scraped_at", sinceIso)
        .order("scraped_at", { ascending: false })
        .limit(500);

      if (marketRows && marketRows.length > 0) {
        // Geocode the input postcode and filter by true Haversine distance.
        // SpareRoom's postcode-anchored search uses the postcode centroid, so
        // listings 2-3 miles away can sneak in. Re-filter using each listing's
        // own lat/lon for accuracy. If geocoding fails, skip distance filtering.
        const origin = await geocodePostcode(normalizedPostcode);

        const enriched: MarketListing[] = marketRows.map((r) => {
          const lat = r.latitude != null ? Number(r.latitude) : null;
          const lon = r.longitude != null ? Number(r.longitude) : null;
          const distance =
            origin && lat != null && lon != null
              ? haversineMiles(origin.latitude, origin.longitude, lat, lon)
              : null;
          return {
            url: r.url,
            title: r.title,
            location_text: r.location_text,
            property_type: r.property_type,
            price: r.price != null ? Number(r.price) : null,
            room_count: r.room_count,
            min_room_price_pcm: r.min_room_price_pcm != null ? Number(r.min_room_price_pcm) : null,
            max_room_price_pcm: r.max_room_price_pcm != null ? Number(r.max_room_price_pcm) : null,
            latitude: lat,
            longitude: lon,
            distance_miles: distance != null ? Math.round(distance * 100) / 100 : null,
            scraped_at: r.scraped_at,
          };
        });

        const filtered = origin
          ? enriched
              .filter(
                (l) =>
                  l.distance_miles == null || l.distance_miles <= MARKET_DEFAULT_RADIUS_MILES
              )
              .sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999))
          : enriched;

        const rentsForRooms: number[] = [];
        for (const r of filtered) {
          if (r.room_count && r.room_count > 1) {
            if (r.min_room_price_pcm) rentsForRooms.push(r.min_room_price_pcm);
            if (
              r.max_room_price_pcm &&
              r.max_room_price_pcm !== r.min_room_price_pcm
            ) {
              rentsForRooms.push(r.max_room_price_pcm);
            }
          } else if (r.price) {
            rentsForRooms.push(r.price);
          }
        }

        marketSummary = {
          count: filtered.length,
          median_rent_pounds: median(rentsForRooms),
          min_rent_pounds: rentsForRooms.length ? Math.min(...rentsForRooms) : null,
          max_rent_pounds: rentsForRooms.length ? Math.max(...rentsForRooms) : null,
          last_scraped_at: filtered[0]?.scraped_at ?? null,
          listings: filtered,
        };
      }
    } catch {
      // market_listings table missing or unavailable — silently fall back
    }
  }

  // ── 2. Build AI prompt ───────────────────────────────────────
  const roomTypes = [...new Set(rooms.map((r) => r.room_type))];
  const roomSummary = rooms
    .map((r) => `Room ${r.room_number}: ${r.room_type}, expected PCM: £${(r.expected_rent_pcm / 100).toFixed(0)}`)
    .join("\n");

  const comparablesSummary =
    comparableData.length > 0
      ? JSON.stringify(
          comparableData.map((c) => ({
            area: c.area,
            type: c.property_type,
            rooms: c.room_count,
            avg_rent_pcm_pounds: Math.round(c.avg_rent_pcm / 100),
            occupancy_pct: Math.round(c.avg_occupancy_rate * 100),
            avg_vacancy_days: c.avg_vacancy_days,
          })),
          null,
          2
        )
      : "No comparable properties found in the portfolio database.";

  const systemPrompt = `You are a UK property investment analyst for a rent-to-rent management company.
You have access to real internal portfolio performance data.
Your job is to provide recommendations for whether to take on a new property, based solely on the company's existing portfolio data.
Be transparent about data limitations. Flag risks clearly.
Respond ONLY with valid JSON matching the exact schema provided. No extra text outside the JSON.`;

  const marketBlock =
    marketSummary.count > 0
      ? `External SpareRoom market data within search radius of ${normalizedPostcode ?? detected_area} (last scraped ${marketSummary.last_scraped_at}):
- Listings found: ${marketSummary.count}
- Rent range (PCM, £): £${marketSummary.min_rent_pounds ?? "?"} – £${marketSummary.max_rent_pounds ?? "?"}
- Median rent (PCM, £): £${marketSummary.median_rent_pounds ?? "?"}
- Sample listings (up to 10):
${marketSummary.listings
  .slice(0, 10)
  .map(
    (l) =>
      `  - ${l.title ?? "Untitled"} | ${l.location_text ?? "?"} | rooms=${l.room_count ?? "?"} | £${
        l.min_room_price_pcm ?? l.price ?? "?"
      }–£${l.max_room_price_pcm ?? l.price ?? "?"} pcm`
  )
  .join("\n")}`
      : `External SpareRoom market data: none available for postcode ${normalizedPostcode ?? "(not provided)"}.`;

  const userPrompt = `Analyse this potential property and provide investment recommendations.

Property:
- Address: ${address}
- Postcode: ${normalizedPostcode ?? "(not provided)"}
- Area: ${detected_area}
- Type: ${property_type.replace("_", " ")}
- Total rooms: ${total_rooms}

Room configuration:
${roomSummary}

Comparable portfolio data (internal only):
${comparablesSummary}
${usedAdjacentArea ? `Note: No exact area match found. Data shown is from ${adjacentAreaName} (adjacent/nearest area).` : ""}

${marketBlock}

Return a JSON object with exactly this shape:
{
  "recommended_rents": [
    {
      "room_type": "single|double|master|ensuite",
      "recommended_rent_pcm": <integer in pence>,
      "reasoning": "<string — cite specific comparable data>"
    }
  ],
  "recommended_occupancy": <number 0.0–1.0>,
  "occupancy_reasoning": "<string>",
  "comparable_properties_used": [
    {
      "area": "<string>",
      "room_count": <integer>,
      "property_type": "hmo|studio|whole_flat",
      "avg_rent_pcm": <integer in pence>,
      "avg_occupancy_rate": <number 0.0–1.0>,
      "avg_vacancy_days": <integer>
    }
  ],
  "risk_flags": [
    {
      "severity": "warning|info",
      "message": "<string>"
    }
  ]
}

Rules:
- recommended_rent_pcm must be in pence (multiply £ by 100)
- Only include room_types that appear in the room configuration above: ${roomTypes.join(", ")}
- If no comparables found, flag as warning and base estimates on UK market knowledge for the area
- Be conservative with occupancy — use actual portfolio data if available`;

  // ── 3. Call OpenAI API ─────────────────────────────────────
  let aiResult: AIResponse;
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!rawText) {
      throw new Error("OpenAI returned an empty response.");
    }

    aiResult = JSON.parse(rawText) as AIResponse;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI request failed." },
      { status: 500 }
    );
  }

  // ── 4. Augment risk flags ────────────────────────────────────
  if (usedAdjacentArea) {
    aiResult.risk_flags = [
      {
        severity: "warning",
        message: `No comparable properties found in ${detected_area}. Results based on ${adjacentAreaName || "adjacent area"} data.`,
      },
      ...(aiResult.risk_flags ?? []),
    ];
  }

  if (comparableData.length === 0) {
    aiResult.risk_flags = [
      {
        severity: "warning",
        message: `No comparable properties found in your portfolio for ${detected_area}. AI recommendations are based on general UK market knowledge only.`,
      },
      ...(aiResult.risk_flags ?? []),
    ];
  }

  return NextResponse.json({
    ...aiResult,
    comparable_properties_used: comparableData,
    market_listings: marketSummary,
  });
}
