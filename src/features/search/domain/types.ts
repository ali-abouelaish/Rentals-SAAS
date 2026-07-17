export type SearchResultKind =
  | "property"
  | "unit"
  | "pm_tenant"
  | "contract"
  | "landlord"
  | "client"
  | "key"
  | "supplier"
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
  landlord: "Landlords",
  client: "Clients",
  key: "Keys",
  supplier: "Suppliers",
};

// Order in which sections render in the dropdown / sheet.
export const KIND_ORDER: SearchResultKind[] = [
  "property",
  "unit",
  "pm_tenant",
  "contract",
  "client",
  "landlord",
  "key",
  "supplier",
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
    case "client":
      return `/clients/${id}`;
    case "key":
      return parentId ? `/properties/${parentId}` : `/keys`;
    case "supplier":
      return `/maintenance?supplier=${id}`;
    case "action":
      return "#";
  }
}
