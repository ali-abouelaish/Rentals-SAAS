export type Portfolio = {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type OwnerLandlord = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  contract_start_date: string | null;
  contract_expiry_date: string | null;
  monthly_rent_owed: number | null;
  payment_schedule: "monthly" | "quarterly" | "biannual" | "annual" | null;
  next_payment_due: string | null;
  contract_document_url: string | null;
  alert_60_days: boolean;
  alert_30_days: boolean;
  created_at: string;
};

export type PropertyManager = {
  id: string;
  tenant_id: string;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};


export type PropertyType = "hmo" | "studio" | "whole_flat";
export type BillsType = "all_included" | "top_up_gas_elec" | "top_up_elec" | "top_up_gas";
export type PreferredOccupation = "professional" | "student" | "any";
export type PreferredGender = "male" | "female" | "any";

export type Property = {
  id: string;
  tenant_id: string;
  portfolio_id: string | null;
  property_type: PropertyType;
  name: string;
  address_line_1: string;
  address_line_2: string | null;
  postcode: string | null;
  area: string | null;
  nearest_tube_station: string | null;
  total_rooms: number | null;
  total_bathrooms: number | null;
  bills: BillsType | null;
  bills_notes: string | null;
  furnished: boolean;
  parking: boolean;
  garden: boolean;
  broadband: boolean;
  washing_machine: boolean;
  dishwasher: boolean;
  central_heating: boolean;
  separate_wc: boolean;
  smoker_ok: boolean;
  pets_ok: boolean;
  preferred_occupation: PreferredOccupation;
  preferred_gender: PreferredGender;
  min_age: number | null;
  max_age: number | null;
  floor_plan_url: string | null;
  owner_landlord_id: string | null;
  manager_landlord_id: string | null;
  contract_start_date: string | null;
  contract_expiry_date: string | null;
  monthly_rent_owed: number | null;
  payment_schedule: "monthly" | "quarterly" | "biannual" | "annual" | null;
  contract_document_url: string | null;
  created_at: string;
  updated_at: string;
  portfolio?: Portfolio | null;
  owner_landlord?: Pick<OwnerLandlord, "id" | "name"> | null;
};

export type UnitType = "room" | "studio" | "whole_flat";
export type RoomType = "single" | "double" | "master" | "ensuite";
export type UnitStatus =
  | "available"
  | "occupied"
  | "move_out"
  | "booked"
  | "on_hold"
  | "renewal"
  | "replacement";
export type FurnishingsType = "furnished" | "unfurnished" | "part_furnished";

export type PropertyResident = {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  occupation: string | null;
  created_at: string;
};

export type Unit = {
  id: string;
  tenant_id: string;
  property_id: string;
  resident_id: string | null;
  unit_type: UnitType;
  room_number: string | null;
  room_type: RoomType | null;
  status: UnitStatus;
  notice_given: boolean;
  available_date: string | null;
  min_price_pcm: number | null;
  max_price_pcm: number | null;
  couples_allowed: boolean;
  couples_price_pcm: number | null;
  deposit: number | null;
  holding_deposit: number | null;
  pm_tenant_id: string | null;
  furnishings: FurnishingsType;
  drive_folder_url: string | null;
  created_at: string;
  updated_at: string;
  property?: Property & { portfolio?: Portfolio | null };
  resident?: PropertyResident | null;
  pm_tenant?: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
  current_contract?: {
    id: string;
    start_date: string;
    status: string;
    document_url: string | null;
    rent_pcm: number | null;
    deposit: number | null;
    pm_tenant_id: string | null;
    pro_rata_amount: number | null;
    prepaid_first_full_month: boolean;
  } | null;
  recent_rent_payments?: UnitRentPayment[];
};

export type UnitRentPayment = {
  id: string;
  period_year: number;
  period_month: number;
  amount: number;
  paid_at: string;
  notes: string | null;
};

export type UnitPhoto = {
  id: string;
  tenant_id: string;
  unit_id: string | null;
  property_id: string | null;
  url: string;
  category: "room" | "bathroom" | "kitchen" | "exterior" | "garden" | "communal" | "wc";
  sort_order: number;
  created_at: string;
};

// Filters for units list/kanban
export type UnitFilters = {
  search: string;
  portfolioIds: string[];
  areas: string[];
  unitTypes: UnitType[];
  roomTypes: RoomType[];
  statuses: UnitStatus[];
  availableFrom: string;
  availableTo: string;
  minPrice: string;
  maxPrice: string;
};

export const UNIT_STATUSES: UnitStatus[] = [
  "available",
  "occupied",
  "move_out",
  "booked",
  "on_hold",
  "renewal",
  "replacement",
];

export const LONDON_AREAS = [
  "Acton", "Aldgate East", "Angel", "Balham", "Bethnal Green", "Bow", "Brixton",
  "Camden Town", "Canada Water", "Canary Wharf", "Chelsea", "Clapham", "Crossharbour",
  "Dalston", "East Dulwich", "Elephant & Castle", "Fulham", "Greenwich", "Hackney",
  "Hammersmith", "Highbury", "Holloway", "Hyde Park", "Islington", "Kennington",
  "Kilburn", "King's Cross", "Maida Vale", "Marble Arch", "Mile End", "Paddington",
  "Pimlico", "Putney", "Shepherd's Bush", "Shoreditch", "Southwark", "Stepney",
  "Stockwell", "Stratford", "Surrey Quays", "Tooting", "Tower Hill", "Vauxhall",
  "Victoria", "Walthamstow", "Wandsworth", "Wembley", "Westferry", "Whitechapel",
  "Wimbledon",
] as const;

export const STATUS_CONFIG: Record<
  UnitStatus,
  { label: string; color: string; bg: string; fg: string; dot: string }
> = {
  available:   { label: "Available",   color: "#16a34a", bg: "bg-green-100",   fg: "text-green-800",   dot: "bg-green-500"   },
  occupied:    { label: "Occupied",    color: "#2563eb", bg: "bg-blue-100",    fg: "text-blue-800",    dot: "bg-blue-500"    },
  move_out:    { label: "Move Out",    color: "#d97706", bg: "bg-amber-100",   fg: "text-amber-800",   dot: "bg-amber-500"   },
  booked:      { label: "Booked",      color: "#7c3aed", bg: "bg-purple-100",  fg: "text-purple-800",  dot: "bg-purple-500"  },
  on_hold:     { label: "On Hold",     color: "#6b7280", bg: "bg-gray-100",    fg: "text-gray-700",    dot: "bg-gray-400"    },
  renewal:     { label: "Renewal",     color: "#0891b2", bg: "bg-cyan-100",    fg: "text-cyan-800",    dot: "bg-cyan-500"    },
  replacement: { label: "Replacement", color: "#ea580c", bg: "bg-orange-100",  fg: "text-orange-800",  dot: "bg-orange-500"  },
};
