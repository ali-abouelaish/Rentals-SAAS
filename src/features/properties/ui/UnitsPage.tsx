"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { UnitFilterBar } from "./UnitFilterBar";
import { UnitsListView } from "./UnitsListView";
import { UnitsKanbanView } from "./UnitsKanbanView";
import { UnitDrawer } from "./UnitDrawer";
import { ManagePortfoliosDialog } from "./CreatePortfolioDialog";
import type { Portfolio, Property, Unit, UnitFilters, UnitRentPayment } from "../domain/types";

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

interface PmTenantOption {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface UnitsPageProps {
  portfolios: Portfolio[];
  initialProperties: Property[];
  initialUnits: Unit[];
  pmTenants: PmTenantOption[];
}

export function UnitsPage({ portfolios: initialPortfolios, initialProperties, initialUnits, pmTenants }: UnitsPageProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [filters, setFilters] = useState<UnitFilters>(DEFAULT_FILTERS);
  const [portfolios, setPortfolios] = useState<Portfolio[]>(initialPortfolios);
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Client-side filtered units
  const filteredUnits = useMemo(() => {
    let result = units;

    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((u) => {
        return (
          u.property?.name?.toLowerCase().includes(s) ||
          u.property?.address_line_1?.toLowerCase().includes(s) ||
          u.room_number?.toLowerCase().includes(s) ||
          u.resident?.full_name?.toLowerCase().includes(s)
        );
      });
    }

    if (filters.portfolioIds.length > 0) {
      result = result.filter(
        (u) => u.property?.portfolio_id && filters.portfolioIds.includes(u.property.portfolio_id)
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

  // Filtered properties: those that have matching units, or match search/portfolio/area on their own
  const filteredProperties = useMemo(() => {
    const unitPropertyIds = new Set(filteredUnits.map((u) => u.property_id));

    return properties.filter((p) => {
      // Always include if it has matching units
      if (unitPropertyIds.has(p.id)) return true;

      // For properties with 0 units: only show if unit-level filters (type, status, room type, price, dates) are not active
      const hasUnitFilters =
        filters.unitTypes.length > 0 ||
        filters.statuses.length > 0 ||
        filters.roomTypes.length > 0 ||
        filters.minPrice ||
        filters.maxPrice ||
        filters.availableFrom ||
        filters.availableTo;
      if (hasUnitFilters) return false;

      // Apply property-level filters
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!p.name.toLowerCase().includes(s) && !p.address_line_1.toLowerCase().includes(s)) return false;
      }
      if (filters.portfolioIds.length > 0 && (!p.portfolio_id || !filters.portfolioIds.includes(p.portfolio_id))) return false;
      if (filters.areas.length > 0 && (!p.area || !filters.areas.includes(p.area))) return false;

      return true;
    });
  }, [properties, filteredUnits, filters]);

  const selectedUnit = selectedUnitId ? units.find((u) => u.id === selectedUnitId) ?? null : null;

  const handleUnitClick = (unitId: string) => {
    setSelectedUnitId(unitId);
    setDrawerOpen(true);
  };

  const handleUnitUpdated = (updated: Unit) => {
    setUnits((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  };

  const handleUnitCreated = (unit: Unit) => {
    setUnits((prev) => [...prev, unit]);
  };

  const handlePropertyDeleted = (propertyId: string) => {
    setProperties((prev) => prev.filter((p) => p.id !== propertyId));
    setUnits((prev) => prev.filter((u) => u.property_id !== propertyId));
  };

  const handlePaymentRecorded = (unitId: string, payment: UnitRentPayment) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        const others = (u.recent_rent_payments ?? []).filter(
          (p) => !(p.period_year === payment.period_year && p.period_month === payment.period_month)
        );
        const merged = [payment, ...others].sort((a, b) => {
          if (a.period_year !== b.period_year) return b.period_year - a.period_year;
          return b.period_month - a.period_month;
        });
        return { ...u, recent_rent_payments: merged };
      })
    );
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Properties</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {properties.length} {properties.length === 1 ? "property" : "properties"} · {units.length} units
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ManagePortfoliosDialog
            portfolios={portfolios}
            onCreated={(portfolio) => setPortfolios((prev) => [...prev, portfolio])}
            onDeleted={(id) => setPortfolios((prev) => prev.filter((p) => p.id !== id))}
          />
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add property
          </Link>
        </div>
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
        <UnitsListView
          properties={filteredProperties}
          units={filteredUnits}
          onUnitClick={handleUnitClick}
          onUnitCreated={handleUnitCreated}
          onPropertyDeleted={handlePropertyDeleted}
          onPaymentRecorded={handlePaymentRecorded}
        />
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
        pmTenants={pmTenants}
      />
    </div>
  );
}
