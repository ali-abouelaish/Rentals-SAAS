"use client";

import { useRouter } from "next/navigation";

type Landlord = { id: string; name: string };

export function BonusesLandlordFilter({
  currentLandlord,
  currentSearch,
  currentStatus,
  landlords,
}: {
  currentLandlord: string;
  currentSearch: string;
  currentStatus: string;
  landlords: Landlord[];
}) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams();
    if (currentSearch) params.set("q", currentSearch);
    if (currentStatus && currentStatus !== "all") params.set("status", currentStatus);
    const v = e.target.value;
    if (v && v !== "all") params.set("landlord", v);
    params.set("page", "1");
    const qs = params.toString();
    router.push(`/bonuses${qs ? `?${qs}` : ""}`);
  };

  return (
    <select
      value={currentLandlord}
      onChange={handleChange}
      className="h-10 rounded-lg border bg-surface-card px-3 text-sm border-border text-foreground-secondary"
      aria-label="Filter by landlord"
    >
      <option value="all">All Landlords</option>
      {landlords.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
