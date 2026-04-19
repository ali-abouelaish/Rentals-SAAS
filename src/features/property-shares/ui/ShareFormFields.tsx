"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { UNIT_STATUSES, STATUS_CONFIG } from "@/features/properties/domain/types";
import type { UnitStatus } from "@/features/properties/domain/types";

export type ShareFormPortfolio = {
  id: string;
  name: string;
  color?: string | null;
};

export type ShareFormProperty = {
  id: string;
  name: string;
  postcode: string | null;
  area: string | null;
  portfolio_id: string | null;
};

type ScopeKind = "all" | "portfolio" | "properties";

interface ShareFormFieldsProps {
  portfolios: ShareFormPortfolio[];
  properties: ShareFormProperty[];
  defaultValues?: {
    name: string;
    description: string | null;
    availability_statuses: UnitStatus[];
    commission_override_pct: number;
    expires_at: string | null;
    portfolio_id: string | null;
    property_ids: string[] | null;
  };
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function deriveInitialScope(defaults: ShareFormFieldsProps["defaultValues"]): ScopeKind {
  if (!defaults) return "all";
  if (defaults.portfolio_id) return "portfolio";
  if (defaults.property_ids && defaults.property_ids.length > 0) return "properties";
  return "all";
}

export function ShareFormFields({ portfolios, properties, defaultValues }: ShareFormFieldsProps) {
  const checkedStatuses = new Set<UnitStatus>(
    defaultValues?.availability_statuses ?? ["available"]
  );

  const [scopeKind, setScopeKind] = useState<ScopeKind>(deriveInitialScope(defaultValues));
  const [portfolioId, setPortfolioId] = useState<string>(defaultValues?.portfolio_id ?? "");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(
    () => new Set(defaultValues?.property_ids ?? [])
  );
  const [search, setSearch] = useState("");

  const filteredProperties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.name, p.postcode, p.area].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [properties, search]);

  function toggleProperty(id: string) {
    setSelectedPropertyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="scope_kind" value={scopeKind} />

      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={defaultValues?.name ?? ""}
          placeholder="e.g. Autumn inventory for Partner A"
          className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Description
          <span className="ml-2 text-xs font-normal text-foreground-muted">Optional</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={defaultValues?.description ?? ""}
          placeholder="Internal note shown on the share page"
          className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Scope</label>
        <p className="text-xs text-foreground-muted">
          Choose which properties appear on this share page.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <ScopeRadio
            value="all"
            label="All properties"
            description="Every property in your account"
            checked={scopeKind === "all"}
            onChange={() => setScopeKind("all")}
          />
          <ScopeRadio
            value="portfolio"
            label="By portfolio"
            description="Single portfolio"
            checked={scopeKind === "portfolio"}
            onChange={() => setScopeKind("portfolio")}
            disabled={portfolios.length === 0}
          />
          <ScopeRadio
            value="properties"
            label="Pick properties"
            description="Choose specific properties"
            checked={scopeKind === "properties"}
            onChange={() => setScopeKind("properties")}
            disabled={properties.length === 0}
          />
        </div>

        {scopeKind === "portfolio" && (
          <div className="mt-3 space-y-1.5">
            <label htmlFor="portfolio_id" className="text-xs font-medium text-foreground">
              Portfolio
            </label>
            <select
              id="portfolio_id"
              name="portfolio_id"
              required
              value={portfolioId}
              onChange={(e) => setPortfolioId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">Select a portfolio...</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {scopeKind === "properties" && (
          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, postcode, or area"
                className="w-full rounded-lg border border-border bg-surface-inset py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground-muted">
                {selectedPropertyIds.size} of {properties.length} selected
              </span>
              {selectedPropertyIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPropertyIds(new Set())}
                  className="text-foreground-muted hover:text-foreground"
                >
                  Clear selection
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-card">
              {filteredProperties.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-foreground-muted">
                  No properties match this search.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredProperties.map((p) => {
                    const checked = selectedPropertyIds.has(p.id);
                    return (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-surface-inset">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleProperty(p.id)}
                            className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                            <div className="truncate text-xs text-foreground-muted">
                              {[p.postcode, p.area].filter(Boolean).join(" · ") || "—"}
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {Array.from(selectedPropertyIds).map((id) => (
              <input key={id} type="hidden" name="property_ids" value={id} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Availability statuses</label>
        <p className="text-xs text-foreground-muted">
          Only units with a selected status will appear on the share page.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {UNIT_STATUSES.map((s) => {
            const cfg = STATUS_CONFIG[s];
            return (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm hover:bg-surface-inset"
              >
                <input
                  type="checkbox"
                  name="availability_statuses"
                  value={s}
                  defaultChecked={checkedStatuses.has(s)}
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                />
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <span className="text-foreground">{cfg.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="commission_override_pct" className="text-sm font-medium text-foreground">
            Commission %
          </label>
          <input
            id="commission_override_pct"
            name="commission_override_pct"
            type="number"
            required
            min={0}
            max={100}
            step="0.01"
            defaultValue={defaultValues?.commission_override_pct ?? 10}
            className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <p className="text-xs text-foreground-muted">Shown on every unit card.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="expires_at" className="text-sm font-medium text-foreground">
            Expiry
            <span className="ml-2 text-xs font-normal text-foreground-muted">Optional</span>
          </label>
          <input
            id="expires_at"
            name="expires_at"
            type="datetime-local"
            defaultValue={toDatetimeLocal(defaultValues?.expires_at ?? null)}
            className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <p className="text-xs text-foreground-muted">Leave blank for no expiry.</p>
        </div>
      </div>
    </div>
  );
}

function ScopeRadio({
  value,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  value: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
        checked
          ? "border-brand bg-brand/5"
          : "border-border bg-surface-card hover:bg-surface-inset"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="radio"
          name="scope_kind_ui"
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="h-4 w-4 border-border text-brand focus:ring-brand"
        />
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <span className="pl-6 text-xs text-foreground-muted">{description}</span>
    </label>
  );
}
