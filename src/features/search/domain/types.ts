export type SearchResultKind =
  | "property"
  | "unit"
  | "pm_tenant"
  | "contract"
  // "landlord" is the rental-agency CRM record; "owner" is the
  // property-management owner (owner_landlords). Separate tables.
  | "landlord"
  | "owner"
  | "client"
  | "key"
  | "supplier"
  | "certificate"
  // Maintenance work orders — `maintenance_jobs` in the schema.
  | "work_order"
  | "action";

export type SearchResult = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  badge?: string | null;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  groupedResults: Partial<Record<SearchResultKind, SearchResult[]>>;
};

export type RecentEntity = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  visitedAt: number;
};

export const KIND_LABELS: Record<Exclude<SearchResultKind, "action">, string> = {
  property: "Properties",
  unit: "Units",
  pm_tenant: "Tenants",
  contract: "Contracts",
  landlord: "Landlords (agency)",
  owner: "Landlords",
  client: "Clients",
  key: "Keys",
  supplier: "Suppliers",
  certificate: "Certificates",
  work_order: "Work Orders",
};

// Order in which sections render in the dropdown / sheet.
export const KIND_ORDER: SearchResultKind[] = [
  "property",
  "unit",
  "pm_tenant",
  "contract",
  "work_order",
  "client",
  "owner",
  "landlord",
  "key",
  "supplier",
  "certificate",
  "action",
];

export function kindToHref(
  kind: SearchResultKind,
  id: string,
  parentId: string | null
): string {
  switch (kind) {
    case "property":
      return `/properties/${id}`;
    case "unit":
      return parentId ? `/properties/${parentId}#unit-${id}` : `/properties`;
    case "pm_tenant":
      return `/tenants?focus=${id}`;
    case "contract":
      return `/contracts?focus=${id}`;
    case "landlord":
      return `/landlords/${id}`;
    case "owner":
      return `/owners/${id}`;
    case "client":
      return `/clients/${id}`;
    case "key":
      return parentId ? `/properties/${parentId}` : `/keys`;
    case "supplier":
      return `/maintenance?supplier=${id}`;
    case "certificate":
      return parentId ? `/properties/${parentId}` : `/compliance`;
    case "work_order":
      return `/maintenance?job=${id}`;
    case "action":
      return "#";
  }
}
