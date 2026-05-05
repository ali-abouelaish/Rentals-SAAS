import type { EndReason } from "./types";

export type TenancyEntry = {
  kind: "tenancy";
  contractId: string;
  tenant: { id: string; name: string; avatarUrl: string | null };
  startDate: string;
  endDate: string | null;          // null = currently active
  scheduledEndDate: string | null; // vacate_date (notice / scheduled)
  rentPence: number;               // whole pounds (matches rent_pcm convention)
  proRataAmount: number | null;    // pro-rated first period (null = no pro-rata)
  rentFrequency: "monthly";
  depositPence: number | null;     // whole pounds (matches deposit convention)
  endReason: EndReason | null;
  arrearsAtEndPence: number;       // whole pounds (matches arrears_at_end)
  wouldRelet: boolean | null;
  endNotes: string | null;
  depositReturned: number | null;       // whole pounds; null = not yet released
  depositReturnedAt: string | null;     // ISO date
  depositReleaseNotes: string | null;
  status: string;
};

export type VoidEntry = {
  kind: "void";
  startDate: string;
  endDate: string | null;          // null = ongoing void (current vacancy)
  durationDays: number;
};

export type TenantHistoryEntry = TenancyEntry | VoidEntry;

export type HistoryStats = {
  totalTenancies: number;
  totalDaysOccupied: number;
  totalDaysVoid: number;
  occupancyPct: number;        // last 365 days, 1 dp
  averageTenancyDays: number;
};

export type UnitHistory = {
  unit: {
    id: string;
    label: string;
    propertyId: string;
    status: string;
  };
  entries: TenantHistoryEntry[];   // reverse chronological
  stats: HistoryStats;
};

export type PropertyHistory = {
  property: { id: string; address: string };
  units: UnitHistory[];
  rollup: HistoryStats;
};
