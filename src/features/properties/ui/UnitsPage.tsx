"use client";

import { useState, useMemo } from "react";
import { UnitFilterBar } from "./UnitFilterBar";
import { CreatePropertyDialog } from "./CreatePropertyDialog";
import { UnitsListView } from "./UnitsListView";
import { UnitsKanbanView } from "./UnitsKanbanView";
import { UnitDrawer } from "./UnitDrawer";
import type { Portfolio, Unit, UnitFilters } from "../domain/types";

type ViewMode = "list" | "kanban";

const DEFAULT_FILTERS: UnitFilters = {
  search: "",
  portfolioIds: [],
  areas: [],
  unitTypes: [],
  roomTypes: [],
  statuses: [],
  availableFrom: "",
  availableTo: "",
  minPrice: "",
  maxPrice: "",
};

interface UnitsPageProps {
  portfolios: Portfolio[];
  initialUnits: Unit[];
}

export function UnitsPage({ portfolios, initialUnits }: UnitsPageProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [filters, setFilters] = useState<UnitFilters>(DEFAULT_FILTERS);
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Client-side filtering for responsive feel
  const filteredUnits = useMemo(() => {
    let result = units;

    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((u) => {
        const addressMatch = u.property?.address_line_1?.toLowerCase().includes(s);
        const roomMatch = u.room_number?.toLowerCase().includes(s);
        const residentMatch = u.resident?.full_name?.toLowerCase().includes(s);
        return addressMatch || roomMatch || residentMatch;
      });
    }

    if (filters.portfolioIds.length > 0) {
      result = result.filter((u) =>
        u.property?.portfolio_id && filters.portfolioIds.includes(u.property.portfolio_id)
      );
    }

    if (filters.areas.length > 0) {
      result = result.filter((u) => u.property?.area && filters.areas.includes(u.property.area));
    }

    if (filters.unitTypes.length > 0) {
      result = result.filter((u) => filters.unitTypes.includes(u.unit_type));
    }

    if (filters.roomTypes.length > 0) {
      result = result.filter((u) => u.room_type && filters.roomTypes.includes(u.room_type));
    }

    if (filters.statuses.length > 0) {
      result = result.filter((u) => filters.statuses.includes(u.status));
    }

    if (filters.availableFrom) {
      result = result.filter((u) => u.available_date && u.available_date >= filters.availableFrom);
    }

    if (filters.availableTo) {
      result = result.filter((u) => u.available_date && u.available_date <= filters.availableTo);
    }

    if (filters.minPrice) {
      const min = parseInt(filters.minPrice);
      result = result.filter((u) => u.max_price_pcm != null && u.max_price_pcm >= min);
    }

    if (filters.maxPrice) {
      const max = parseInt(filters.maxPrice);
      result = result.filter((u) => u.min_price_pcm != null && u.min_price_pcm <= max);
    }

    return result;
  }, [units, filters]);

  const selectedUnit = selectedUnitId ? units.find((u) => u.id === selectedUnitId) ?? null : null;

  const handleUnitClick = (unitId: string) => {
    setSelectedUnitId(unitId);
    setDrawerOpen(true);
  };

  const handleUnitUpdated = (updated: Unit) => {
    setUnits((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Properties</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {units.length} units across {portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreatePropertyDialog
          portfolios={portfolios}
          onCreated={(newUnits) => setUnits((prev) => [...prev, ...newUnits])}
        />
      </div>

      {/* Filter bar */}
      <UnitFilterBar
        filters={filters}
        onChange={setFilters}
        view={view}
        onViewChange={setView}
        portfolios={portfolios}
        totalUnits={filteredUnits.length}
      />

      {/* Content */}
      {view === "list" ? (
        <UnitsListView units={filteredUnits} onUnitClick={handleUnitClick} />
      ) : (
        <UnitsKanbanView
          units={filteredUnits}
          onUnitClick={handleUnitClick}
          onUnitsChange={setUnits}
        />
      )}

      {/* Unit drawer */}
      <UnitDrawer
        unit={selectedUnit}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUnitUpdated={handleUnitUpdated}
      />
    </div>
  );
}
