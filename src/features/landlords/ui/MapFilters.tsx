"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { mapFilterSchema, type MapFilterValues } from "../domain/schemas";

const inputCls =
  "h-11 sm:h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

/**
 * Budget and double-occupancy filters for the landlords map. They narrow
 * listings, not landlords, so they drive the map only and live in the URL
 * (?budget=&double=1) beside the list's own filters.
 */
export function MapFilters({ budget, double }: MapFilterValues) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MapFilterValues>({
    resolver: zodResolver(mapFilterSchema),
    values: { budget, double },
  });

  const go = (values: MapFilterValues) => {
    const params = new URLSearchParams(searchParams.toString());
    if (values.budget) params.set("budget", values.budget);
    else params.delete("budget");
    if (values.double) params.set("double", "1");
    else params.delete("double");
    const qs = params.toString();
    // scroll: false — the map is mid-page; jumping to the top on every apply
    // would throw the user away from what they are looking at.
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const active = budget !== "" || double;

  return (
    // noValidate: Zod owns validation, not the browser's native tooltips.
    <form
      onSubmit={handleSubmit(go)}
      noValidate
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start"
    >
      <div className="flex flex-col gap-1 sm:w-48">
        <label htmlFor="map-budget" className="text-sm font-medium text-foreground">
          Budget (£ pcm)
        </label>
        <input
          id="map-budget"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 900"
          // Also on the server-rendered HTML, so an active filter doesn't
          // flash empty until hydration.
          defaultValue={budget}
          {...register("budget")}
          className={inputCls}
        />
        {errors.budget && <p className="text-xs text-error">{errors.budget.message}</p>}
        <p className="text-xs text-foreground-muted">Whole pounds. Hides listings priced above it.</p>
      </div>

      <div className="flex flex-col gap-1 sm:pt-7">
        <label className="flex min-h-11 sm:min-h-10 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={double}
            {...register("double")}
            className="h-5 w-5 sm:h-4 sm:w-4 rounded border-border text-brand focus:ring-brand"
          />
          <span className="text-sm font-medium text-foreground">Double occupancy</span>
        </label>
        <p className="text-xs text-foreground-muted">Only listings marked as accepting couples.</p>
      </div>

      <div className="flex gap-2 sm:pt-7">
        <Tooltip content="Redraws the map with these filters. The landlord list below isn't affected — these filter listings, not landlords.">
          <Button type="submit" variant="secondary" className="h-11 sm:h-10">
            Apply
          </Button>
        </Tooltip>
        {active && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 sm:h-10"
            onClick={() => {
              reset({ budget: "", double: false });
              go({ budget: "", double: false });
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
