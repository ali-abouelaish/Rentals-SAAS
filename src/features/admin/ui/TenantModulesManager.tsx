"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  saveModuleConfigDraftAction,
  publishModuleConfigAction,
  revertModuleConfigAction
} from "../actions/admin";
import type { AgencyModuleConfig } from "../domain/types";
import {
  FileText,
  Building2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";

type ModuleSelection = "rental_only" | "pm_only" | "both";

function getSelectionFromConfig(config: AgencyModuleConfig | null): ModuleSelection {
  if (!config) return "rental_only";
  if (config.rental_agency_enabled && config.property_management_enabled) return "both";
  if (config.property_management_enabled) return "pm_only";
  return "rental_only";
}

function getLiveSelectionFromConfig(config: AgencyModuleConfig | null): ModuleSelection {
  if (!config) return "rental_only";
  if (config.live_rental_agency_enabled && config.live_property_management_enabled) return "both";
  if (config.live_property_management_enabled) return "pm_only";
  return "rental_only";
}

function selectionLabel(s: ModuleSelection) {
  if (s === "rental_only") return "Rental Agency only";
  if (s === "pm_only") return "Property Management only";
  return "Both";
}

const MODULE_OPTIONS: {
  value: ModuleSelection;
  label: string;
  subtitle: string;
  icon: typeof FileText;
  includes: string[];
}[] = [
  {
    value: "rental_only",
    label: "Rental Agency",
    subtitle: "Letting agency tools",
    icon: FileText,
    includes: [
      "Rentals",
      "Clients & Leads",
      "Agents",
      "Bonuses",
      "Invoices",
      "Room Enhancer",
      "Billing"
    ]
  },
  {
    value: "pm_only",
    label: "Property Management",
    subtitle: "Harbor Ops PM tools",
    icon: Building2,
    includes: [
      "Properties",
      "Bookings",
      "Tenants",
      "Contracts",
      "Profitability",
      "Rent Collection",
      "Maintenance",
      "Acquisition Insights",
      "Marketing"
    ]
  },
  {
    value: "both",
    label: "Both",
    subtitle: "Full access to both products",
    icon: Layers,
    includes: ["All Rental Agency tools", "All Property Management tools", "Tab toggle on dashboard"]
  }
];

export function TenantModulesManager({
  tenantId,
  config
}: {
  tenantId: string;
  config: AgencyModuleConfig | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selection, setSelection] = useState<ModuleSelection>(getSelectionFromConfig(config));

  const liveSelection = getLiveSelectionFromConfig(config);
  const hasDraftChanges = config ? !config.published : selection !== "rental_only";
  const draftDiffersFromLive = selectionLabel(selection) !== selectionLabel(liveSelection);

  const saveDraft = () => {
    startTransition(async () => {
      const result = await saveModuleConfigDraftAction({
        tenantId,
        rentalAgencyEnabled: selection === "rental_only" || selection === "both",
        propertyManagementEnabled: selection === "pm_only" || selection === "both"
      });
      if (!result.ok) {
        toast.error("Failed to save draft", { description: result.error });
        return;
      }
      toast.success("Draft saved");
      router.refresh();
    });
  };

  const publish = () => {
    startTransition(async () => {
      const result = await publishModuleConfigAction({ tenantId });
      if (!result.ok) {
        toast.error("Failed to publish", { description: result.error });
        return;
      }
      toast.success("Module config published — takes effect on agency's next page load");
      router.refresh();
    });
  };

  const revert = () => {
    startTransition(async () => {
      const result = await revertModuleConfigAction({ tenantId });
      if (!result.ok) {
        toast.error("Failed to revert", { description: result.error });
        return;
      }
      toast.success("Reverted to published config");
      setSelection(liveSelection);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Module selector */}
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Module assignment</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODULE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = selection === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelection(opt.value)}
                disabled={isPending}
                className={cn(
                  "relative text-left rounded-xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active
                    ? "border-brand bg-brand/5 ring-1 ring-brand"
                    : "border-border bg-surface-card hover:border-brand/40 hover:bg-surface-inset"
                )}
              >
                {active && (
                  <CheckCircle2
                    size={16}
                    className="absolute top-3 right-3 text-brand"
                  />
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={18} className={active ? "text-brand" : "text-foreground-secondary"} />
                  <p className={cn("text-sm font-semibold", active ? "text-brand" : "text-foreground")}>
                    {opt.label}
                  </p>
                </div>
                <p className="text-xs text-foreground-secondary mb-3">{opt.subtitle}</p>
                <ul className="space-y-1">
                  {opt.includes.map((item) => (
                    <li key={item} className="text-xs text-foreground-secondary flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-foreground-muted shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save draft */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={saveDraft}
          disabled={isPending}
        >
          Save Draft
        </Button>
        {hasDraftChanges && config && (
          <p className="text-xs text-foreground-secondary flex items-center gap-1.5">
            <AlertCircle size={12} className="text-amber-500" />
            Unsaved or unpublished changes
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Publish panel */}
      <div className="rounded-xl border border-border bg-surface-inset p-4 space-y-4">
        <p className="text-sm font-semibold text-foreground">Publish panel</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Current live */}
          <div className="rounded-lg border border-border bg-surface-card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 size={13} className="text-green-500" />
              <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">
                Currently live
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {config ? selectionLabel(liveSelection) : "Default (Rental Agency only)"}
            </p>
            {config?.published_at && (
              <p className="text-xs text-foreground-muted mt-1 flex items-center gap-1">
                <Clock size={11} />
                Published {formatDate(config.published_at)}
                {config.published_by_name ? ` by ${config.published_by_name}` : ""}
              </p>
            )}
          </div>

          {/* Draft */}
          <div
            className={cn(
              "rounded-lg border p-3",
              draftDiffersFromLive
                ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700"
                : "border-border bg-surface-card"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle
                size={13}
                className={draftDiffersFromLive ? "text-amber-500" : "text-foreground-muted"}
              />
              <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">
                {draftDiffersFromLive ? "Draft — not yet published" : "Draft"}
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">{selectionLabel(selection)}</p>
            {config?.last_updated_at && config.last_updated_by_name && (
              <p className="text-xs text-foreground-muted mt-1 flex items-center gap-1">
                <Clock size={11} />
                Updated {formatDate(config.last_updated_at)} by {config.last_updated_by_name}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={publish}
            disabled={isPending || !config}
            className="font-semibold"
          >
            Publish
          </Button>
          {!config && (
            <p className="text-xs text-foreground-secondary">Save a draft first to enable publishing.</p>
          )}
          {config && draftDiffersFromLive && (
            <p className="text-xs text-foreground-secondary">
              Publishing will change live config from{" "}
              <strong>{selectionLabel(liveSelection)}</strong> →{" "}
              <strong>{selectionLabel(selection)}</strong>
            </p>
          )}
          {config && !config.published && (
            <Button
              size="sm"
              variant="ghost"
              onClick={revert}
              disabled={isPending}
              className="text-foreground-secondary"
            >
              Revert to published
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
