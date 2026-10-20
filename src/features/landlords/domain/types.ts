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
