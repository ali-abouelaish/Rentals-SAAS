"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  setTenantFeatureEnabledAction,
  setTenantFeatureEndDateAction
} from "../actions/admin";
import type { TenantFeatureEntitlement } from "../domain/types";
import { FEATURE_META, type FeatureKey } from "@/lib/entitlements/features";

export function TenantFeaturesManager({
  tenantId,
  entitlements
}: {
  tenantId: string;
  entitlements: TenantFeatureEntitlement[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dates, setDates] = useState<Record<string, string>>(
    () =>
      entitlements.reduce<Record<string, string>>((acc, row) => {
        acc[row.feature_key] = row.ends_on ?? "";
        return acc;
      }, {})
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const toggleFeature = (featureKey: string, enabled: boolean) => {
    startTransition(async () => {
      const result = await setTenantFeatureEnabledAction({
        tenantId,
        featureKey,
        enabled
      });
      if (!result.ok) {
        toast.error("Unable to update feature", { description: result.error });
        return;
      }
      toast.success(enabled ? "Feature enabled" : "Feature disabled");
      router.refresh();
    });
  };

  const saveDate = (featureKey: string) => {
    startTransition(async () => {
      const value = dates[featureKey] || null;
      const result = await setTenantFeatureEndDateAction({
        tenantId,
        featureKey,
        endsOn: value
      });
      if (!result.ok) {
        toast.error("Unable to update end date", { description: result.error });
        return;
      }
      toast.success(value ? "Feature end date saved" : "Feature end date cleared");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {entitlements.map((row) => {
        const key = row.feature_key as FeatureKey;
        const meta = FEATURE_META[key];
        const isExpired = Boolean(row.ends_on && row.ends_on < today);
        const isActive = row.is_enabled && !isExpired;

        return (
          <div
            key={row.feature_key}
            className="rounded-xl border border-border bg-surface-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {meta?.label ?? row.feature_key}
                </p>
                <p className="text-xs text-foreground-secondary mt-0.5">
                  {meta?.description ?? "Feature access control."}
                </p>
                <div className="mt-2">
                  <StatusBadge status={isActive ? "active" : "inactive"} size="sm" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={row.is_enabled ? "outline" : "success"}
                  onClick={() => toggleFeature(row.feature_key, !row.is_enabled)}
                  disabled={isPending}
                >
                  {row.is_enabled ? "Disable" : "Enable"}
                </Button>

                <Input
                  type="date"
                  value={dates[row.feature_key] ?? ""}
                  onChange={(e) =>
                    setDates((prev) => ({ ...prev, [row.feature_key]: e.target.value }))
                  }
                  className="h-8 text-xs w-[170px]"
                  disabled={isPending}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveDate(row.feature_key)}
                  disabled={isPending}
                >
                  Save Date
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDates((prev) => ({ ...prev, [row.feature_key]: "" }));
                    startTransition(async () => {
                      const result = await setTenantFeatureEndDateAction({
                        tenantId,
                        featureKey: row.feature_key,
                        endsOn: null
                      });
                      if (!result.ok) {
                        toast.error("Unable to clear end date", { description: result.error });
                        return;
                      }
                      toast.success("End date cleared");
                      router.refresh();
                    });
                  }}
                  disabled={isPending}
                >
                  Clear Date
                </Button>
              </div>
            </div>
            {row.ends_on && (
              <p className="text-xs text-foreground-muted mt-2">
                End date: {row.ends_on}
                {isExpired ? " (expired)" : ""}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

