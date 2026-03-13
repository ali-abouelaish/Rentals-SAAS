"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 350;

type Props = {
  placeholder?: string;
  initialQuery?: string;
  /** Preserve status filter when updating search. Page is always reset to 1. */
  preserveStatus?: string;
  /** Preserve landlord filter (bonuses page). */
  preserveLandlord?: string;
  /** Preserve paying filter (landlords page). */
  preservePaying?: string;
};

export function LiveSearchInput({
  placeholder = "Search...",
  initialQuery = "",
  preserveStatus,
  preserveLandlord,
  preservePaying,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);

  // Sync from URL when initialQuery changes (e.g. server re-render after navigation)
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  // Debounce: update URL when value stops changing (skip if unchanged to avoid redundant push)
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = value.trim();
      const current = (initialQuery ?? "").trim();
      if (trimmed === current) return;
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      if (preserveStatus) params.set("status", preserveStatus);
      if (preserveLandlord) params.set("landlord", preserveLandlord);
      if (preservePaying) params.set("paying", preservePaying);
      params.set("page", "1");
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.push(url);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, pathname, preserveStatus, preserveLandlord, preservePaying, router, initialQuery]);

  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9"
        aria-label="Search"
      />
    </div>
  );
}
