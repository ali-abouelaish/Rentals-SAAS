const SPAREROOM_SEARCH_BASE = "https://www.spareroom.co.uk/flatshare/";

export type SpareroomSearchOptions = {
  radius_miles?: number;
  offset?: number;
};

export function buildSpareroomSearchUrl(
  postcode: string,
  options: SpareroomSearchOptions = {}
): string {
  const { radius_miles = 1, offset } = options;

  const params = new URLSearchParams({
    search: postcode.trim(),
    miles_from_max: String(radius_miles),
    search_type: "offered",
    action: "search",
  });

  if (typeof offset === "number") {
    params.set("offset", String(offset));
  }

  return `${SPAREROOM_SEARCH_BASE}?${params.toString()}`;
}
