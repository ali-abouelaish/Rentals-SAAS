import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RoomConfig, ComparableProperty, PropertyType, RoomType } from "@/features/acquisition-insights/domain/types";

export const runtime = "nodejs";

type RequestBody = {
  evaluationId?: string;
  address: string;
  detected_area: string;
  property_type: PropertyType;
  total_rooms: number;
  rooms: RoomConfig[];
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

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server missing ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { address, detected_area, property_type, total_rooms, rooms } = body;

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

  const userPrompt = `Analyse this potential property and provide investment recommendations.

Property:
- Address: ${address}
- Area: ${detected_area}
- Type: ${property_type.replace("_", " ")}
- Total rooms: ${total_rooms}

Room configuration:
${roomSummary}

Comparable portfolio data (internal only):
${comparablesSummary}
${usedAdjacentArea ? `Note: No exact area match found. Data shown is from ${adjacentAreaName} (adjacent/nearest area).` : ""}

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

  // ── 3. Call Anthropic API ──────────────────────────────────
  let aiResult: AIResponse;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const apiData = await response.json();
    const rawText: string = apiData.content?.[0]?.text ?? "";

    // Strip markdown code fences if present
    const jsonText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    aiResult = JSON.parse(jsonText) as AIResponse;
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
  });
}
