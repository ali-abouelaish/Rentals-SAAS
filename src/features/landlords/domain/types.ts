export type Landlord = {
  id: string;
  tenant_id: string;
  name: string;
  contact: string | null;
  billing_address: string | null;
  email: string | null;
  spareroom_profile_url: string | null;
  pays_commission: boolean;
  commission_amount_gbp: number;
  commission_term_text: string | null;
  we_do_viewing: boolean;
  profile_notes: string | null;
  created_at: string;
};

/** One full-roster SpareRoom scrape, from spareroom_scrape_runs. */
export type ScrapeRun = {
  id: string;
  trigger: "schedule" | "manual";
  started_by_name: string | null;
  status: "running" | "success" | "failed";
  started_at: string;
  finished_at: string | null;
  landlords_total: number | null;
  landlords_refreshed: number | null;
  listings_posted: number | null;
  listings_swept: number | null;
  unreadable: { id: string; name: string }[];
  cleared: { id: string; name: string }[];
  error_message: string | null;
};

export type ScrapeRunsState = {
  /** False until migration 20261023000001 creates the table; the run section is hidden. */
  available: boolean;
  /** The run in progress, if any. */
  current: ScrapeRun | null;
  /** The most recent finished run. */
  last: ScrapeRun | null;
};

/** One scraped listing as plotted on the landlords map — only what a pin and its popup need. */
export type ListingMapPoint = {
  id: string;
  landlordId: string | null;
  landlordName: string | null;
  title: string | null;
  location: string | null;
  priceGbp: number | null;
  /** Multi-room ad: priceGbp is the cheapest room, so it reads "from £…". */
  fromPrice: boolean;
  roomCount: number | null;
  /** Absolute http(s) advert URL only; anything else is dropped. */
  url: string | null;
  lastSeenAt: string | null;
  lat: number;
  lng: number;
};
