import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { getAspsps } from "@/lib/enablebanking";

/**
 * Sandbox-friendly lookup. EB's sandbox typically only exposes a handful of
 * test ASPSPs that don't always carry `psu_types: ["business"]`, so a strict
 * `country=GB&psu_type=business` filter usually returns an empty array.
 * Strategy: try the strict filter first; if empty, fall back to all GB; if
 * still empty, return whatever ASPSPs are visible to this app — labelled with
 * their country so the demo always shows something pickable.
 */
export async function GET() {
  await requireUserProfile();
  try {
    const attempts: Array<{ label: string; fn: () => Promise<{ name: string; country: string; logo?: string | null }[]> }> = [
      {
        label: "GB business",
        fn: async () =>
          (await getAspsps("GB", "business")).map((a) => ({
            name: a.name,
            country: a.country,
            logo: a.logo ?? null
          }))
      },
      {
        label: "GB any PSU",
        fn: async () =>
          (await getAspsps("GB")).map((a) => ({
            name: a.name,
            country: a.country,
            logo: a.logo ?? null
          }))
      }
    ];

    // Fallback: walk a few likely sandbox countries until we get a non-empty list.
    const sandboxCountries = ["FI", "SE", "NO", "DK", "DE", "FR"];
    for (const c of sandboxCountries) {
      attempts.push({
        label: `${c} any PSU`,
        fn: async () =>
          (await getAspsps(c)).map((a) => ({
            name: a.name,
            country: a.country,
            logo: a.logo ?? null
          }))
      });
    }

    let banks: { name: string; country: string; logo?: string | null }[] = [];
    let source = "none";
    for (const attempt of attempts) {
      const result = await attempt.fn();
      if (result.length > 0) {
        banks = result;
        source = attempt.label;
        break;
      }
    }
    return NextResponse.json({ banks, source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load banks";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
