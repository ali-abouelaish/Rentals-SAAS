"use client";

import { Building2, FileSignature, Home, Key as KeyIcon, Landmark, Search, Users, Users2, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import {
  KIND_LABELS,
  KIND_ORDER,
  type RecentEntity,
  type SearchResult,
  type SearchResultKind,
} from "../domain/types";

type Props = {
  query: string;
  results: SearchResult[];
  loading: boolean;
  recent: RecentEntity[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (result: SearchResult | RecentEntity) => void;
};

const ICON_BY_KIND: Record<SearchResultKind, typeof Search> = {
  property: Warehouse,
  unit: Home,
  pm_tenant: Users2,
  contract: FileSignature,
  client: Users,
  landlord: Building2,
  key: KeyIcon,
  action: Landmark,
};

function ResultIcon({ kind }: { kind: SearchResultKind }) {
  const Icon = ICON_BY_KIND[kind] ?? Search;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-ground text-foreground-muted">
      <Icon size={16} strokeWidth={1.8} />
    </span>
  );
}

function Row({
  active,
  onMouseEnter,
  onClick,
  icon,
  title,
  subtitle,
  badge,
}: {
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  subtitle: string | null;
  badge?: string | null;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
        "transition-colors duration-100",
        active ? "bg-accent/10 text-foreground" : "text-foreground hover:bg-surface-ground"
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{title}</div>
        {subtitle ? (
          <div className="truncate text-[11px] text-foreground-muted">{subtitle}</div>
        ) : null}
      </div>
      {badge ? (
        <span className="shrink-0 rounded-md bg-surface-ground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
      {children}
    </div>
  );
}

export function SearchResultsList({
  query,
  results,
  loading,
  recent,
  activeIndex,
  onActiveIndexChange,
  onSelect,
}: Props) {
  const trimmedQuery = query.trim();

  // Empty query → recents (or empty hint).
  if (!trimmedQuery) {
    if (recent.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-[13px] text-foreground-muted">
          Start typing to search across properties, tenants, contracts, and more.
        </div>
      );
    }
    const items = recent.slice(0, 5);
    return (
      <div role="listbox" className="py-2">
        <SectionHeader>Recent</SectionHeader>
        <div className="px-2">
          {items.map((entity, index) => (
            <Row
              key={`${entity.kind}-${entity.id}`}
              active={activeIndex === index}
              onMouseEnter={() => onActiveIndexChange(index)}
              onClick={() => onSelect(entity)}
              icon={<ResultIcon kind={entity.kind} />}
              title={entity.title}
              subtitle={entity.subtitle}
            />
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div role="listbox" className="space-y-2 px-3 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-surface-ground" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 animate-pulse rounded bg-surface-ground" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-surface-ground" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[13px] text-foreground-muted">
        No matches for &ldquo;{trimmedQuery}&rdquo;.
      </div>
    );
  }

  // Group by kind in display order. activeIndex tracks the flat list,
  // so we keep a running counter while rendering.
  let cursor = 0;
  return (
    <div role="listbox" className="py-2">
      {KIND_ORDER.map((kind) => {
        if (kind === "action") return null;
        const group = results.filter((r) => r.kind === kind);
        if (group.length === 0) return null;
        const label = KIND_LABELS[kind as Exclude<SearchResultKind, "action">];

        return (
          <div key={kind}>
            <SectionHeader>{label}</SectionHeader>
            <div className="px-2">
              {group.map((result) => {
                const index = cursor++;
                return (
                  <Row
                    key={`${result.kind}-${result.id}`}
                    active={activeIndex === index}
                    onMouseEnter={() => onActiveIndexChange(index)}
                    onClick={() => onSelect(result)}
                    icon={<ResultIcon kind={result.kind} />}
                    title={result.title}
                    subtitle={result.subtitle}
                    badge={result.badge ?? null}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Flatten results into the same order SearchResultsList renders them
 * so keyboard navigation indices line up. Used by the bar's parent.
 */
export function flattenResults(
  results: SearchResult[],
  recent: RecentEntity[],
  hasQuery: boolean
): Array<SearchResult | RecentEntity> {
  if (!hasQuery) return recent.slice(0, 5);
  const flat: SearchResult[] = [];
  for (const kind of KIND_ORDER) {
    if (kind === "action") continue;
    flat.push(...results.filter((r) => r.kind === kind));
  }
  return flat;
}
