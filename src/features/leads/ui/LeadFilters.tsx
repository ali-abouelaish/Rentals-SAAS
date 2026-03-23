"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";

const STATUS_OPTIONS = ["all", "new", "contacted", "viewing", "offer", "closed"];

interface Props {
  sources: string[];
}

export function LeadFilters({ sources }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("q") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentSource = searchParams.get("source") ?? "all";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
        <input
          type="search"
          placeholder="Search by name, email or phone..."
          defaultValue={currentSearch}
          onChange={(e) => updateParam("q", e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-inset pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground-muted">Status</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => updateParam("status", s)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize ${
                currentStatus === s
                  ? "bg-accent text-accent-fg border-accent"
                  : "bg-surface-inset text-foreground-secondary border-border hover:border-accent/50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {sources.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground-muted">Source</p>
          <div className="flex flex-wrap gap-2">
            {["all", ...sources].map((s) => (
              <button
                key={s}
                onClick={() => updateParam("source", s)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize ${
                  currentSource === s
                    ? "bg-accent text-accent-fg border-accent"
                    : "bg-surface-inset text-foreground-secondary border-border hover:border-accent/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
