"use client";

import { useState, useEffect } from "react";
import { Pencil, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { UnitStatusBadge } from "./UnitStatusBadge";
import { PortfolioBadge } from "./PortfolioBadge";
import { OverviewTab } from "./OverviewTab";
import { TenantTab } from "./TenantTab";
import { PhotosTab } from "./PhotosTab";
import { MarketingTab } from "./MarketingTab";
import { UnitHistoryPanel } from "@/features/contracts/ui/UnitHistoryPanel";
import type { Unit } from "../domain/types";

function formatUnitLabel(unit: Unit): string {
  if (unit.unit_type === "room") {
    const roomLabel = unit.room_type
      ? unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)
      : "Room";
    return unit.room_number ? `Room ${unit.room_number} · ${roomLabel}` : roomLabel;
  }
  if (unit.unit_type === "studio") return "Studio";
  return "Whole Flat";
}

interface PmTenantOption {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface UnitDrawerProps {
  unit: Unit | null;
  open: boolean;
  onClose: () => void;
  onUnitUpdated: (unit: Unit) => void;
  pmTenants: PmTenantOption[];
}

export function UnitDrawer({ unit, open, onClose, onUnitUpdated, pmTenants }: UnitDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [localUnit, setLocalUnit] = useState<Unit | null>(unit);

  // Sync local unit when prop changes
  useEffect(() => {
    setLocalUnit(unit);
    setIsEditing(false);
    setActiveTab("overview");
  }, [unit?.id]);

  if (!localUnit) return null;

  const portfolio = localUnit.property?.portfolio;

  const handleUnitSaved = (updated: Unit) => {
    const merged = { ...localUnit, ...updated };
    setLocalUnit(merged);
    onUnitUpdated(merged);
    setIsEditing(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {portfolio && <PortfolioBadge portfolio={portfolio} size="sm" />}
                <UnitStatusBadge status={localUnit.status} size="sm" />
              </div>
              <div>
                <p className="text-xs text-foreground-secondary truncate">
                  {localUnit.property?.address_line_1}
                  {localUnit.property?.area ? ` · ${localUnit.property.area}` : ""}
                </p>
                <h2 className="text-base font-semibold text-foreground">{formatUnitLabel(localUnit)}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant={isEditing ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-8"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {isEditing ? "Editing" : "Edit"}
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="border-b border-border px-6 pt-2 pb-0 shrink-0">
          <Tabs defaultValue="overview" className="!space-y-0">
            <TabsList className="!bg-transparent !border-0 !shadow-none !p-0 gap-0 h-auto">
              {[
                { value: "overview", label: "Overview" },
                { value: "tenant", label: "Tenant" },
                { value: "history", label: "History" },
                { value: "photos", label: "Photos" },
                { value: "marketing", label: "Marketing" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                    activeTab === tab.value
                      ? "border-brand text-brand"
                      : "border-transparent text-foreground-secondary hover:text-foreground hover:border-border"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "overview" && (
            <OverviewTab
              unit={localUnit}
              isEditing={isEditing}
              onSaved={handleUnitSaved}
            />
          )}
          {activeTab === "tenant" && (
            <TenantTab
              unit={localUnit}
              pmTenants={pmTenants}
              onUnitUpdated={(updated) => {
                setLocalUnit(updated);
                onUnitUpdated(updated);
              }}
            />
          )}
          {activeTab === "history" && <UnitHistoryPanel unitId={localUnit.id} />}
          {activeTab === "photos" && <PhotosTab unit={localUnit} />}
          {activeTab === "marketing" && <MarketingTab />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
