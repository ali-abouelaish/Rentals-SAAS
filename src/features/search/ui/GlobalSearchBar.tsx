"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useRecentEntities } from "../hooks/useRecentEntities";
import {
  flattenResults,
  SearchResultsList,
} from "./SearchResultsList";
import type {
  RecentEntity,
  SearchResponse,
  SearchResult,
} from "../domain/types";

type Props = {
  tenantId: string;
};

const DEBOUNCE_MS = 150;
const PLACEHOLDER = "Search properties, tenants, contracts…";

function isMacLike() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function GlobalSearchBar({ tenantId }: Props) {
  const router = useRouter();
  const { recent } = useRecentEntities(tenantId);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const macRef = useRef(false);

  useEffect(() => {
    macRef.current = isMacLike();
  }, []);

  // Responsive switch — match desktop bar at ≥ 768px.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsMobile(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Global keyboard shortcuts: Cmd/Ctrl+K and "/".
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const cmd = (macRef.current ? e.metaKey : e.ctrlKey) && !e.shiftKey && !e.altKey;
      if (cmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isMobile) {
          setMobileSheetOpen(true);
        } else {
          inputRef.current?.focus();
          inputRef.current?.select();
          setOpen(true);
        }
        return;
      }
      if (e.key === "/" && !isEditableElement(e.target)) {
        e.preventDefault();
        if (isMobile) {
          setMobileSheetOpen(true);
        } else {
          inputRef.current?.focus();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile]);

  // Outside click for the desktop dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Focus the sheet's input when it opens.
  useEffect(() => {
    if (mobileSheetOpen) {
      const t = setTimeout(() => sheetInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [mobileSheetOpen]);

  // Debounced search fetch.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setActiveIndex(0);
      return;
    }

    setLoading(true);
    const reqId = ++requestIdRef.current;
    const handle = setTimeout(async () => {
      try {
        const url = `/api/search?q=${encodeURIComponent(trimmed)}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) {
          if (reqId === requestIdRef.current) {
            setResults([]);
            setLoading(false);
          }
          return;
        }
        const json = (await res.json()) as SearchResponse;
        if (reqId !== requestIdRef.current) return;
        const grouped: SearchResult[] = [];
        const order = json.groupedResults
          ? Object.values(json.groupedResults).flatMap((g) => g ?? [])
          : json.results;
        grouped.push(...order);
        setResults(grouped.length > 0 ? grouped : json.results);
        setLoading(false);
        setActiveIndex(0);
      } catch {
        if (reqId === requestIdRef.current) {
          setResults([]);
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  const flat = useMemo(
    () => flattenResults(results, recent, query.trim().length > 0),
    [results, recent, query]
  );

  const handleSelect = (item: SearchResult | RecentEntity) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    setMobileSheetOpen(false);
    inputRef.current?.blur();
    sheetInputRef.current?.blur();
    router.push(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const item = flat[activeIndex];
      if (item) {
        e.preventDefault();
        handleSelect(item);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setMobileSheetOpen(false);
      inputRef.current?.blur();
      sheetInputRef.current?.blur();
    }
  };

  const showDropdown = open && !isMobile;

  return (
    <>
      {/* Desktop / tablet bar */}
      <div
        ref={containerRef}
        className={cn(
          "relative hidden md:block",
          "w-full max-w-[560px]"
        )}
      >
        <div className="relative">
          <Search
            size={15}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            aria-label="Search"
            aria-expanded={showDropdown}
            aria-controls="global-search-results"
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "h-9 w-full rounded-lg border border-border bg-surface-ground",
              "pl-9 pr-16 text-[13px] text-foreground placeholder:text-foreground-muted",
              "outline-none transition-colors duration-base",
              "focus:border-accent/40 focus:bg-surface-card focus:ring-2 focus:ring-accent/20"
            )}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 rounded border border-border bg-surface-card px-1.5 py-0.5 text-[10px] font-semibold text-foreground-muted lg:inline-flex">
            <kbd className="font-sans">⌘</kbd>
            <kbd className="font-sans">K</kbd>
          </span>
        </div>

        {showDropdown && (
          <div
            id="global-search-results"
            className={cn(
              "absolute left-0 right-0 top-full z-50 mt-2",
              "max-h-[70vh] overflow-y-auto",
              "rounded-xl border border-border bg-surface-card shadow-xl"
            )}
          >
            <SearchResultsList
              query={query}
              results={results}
              loading={loading}
              recent={recent}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>

      {/* Mobile trigger button — replaces the input on small screens. */}
      <button
        type="button"
        onClick={() => setMobileSheetOpen(true)}
        aria-label="Search"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-ground",
          "text-foreground-muted transition-colors hover:text-foreground md:hidden"
        )}
      >
        <Search size={16} strokeWidth={1.8} />
      </button>

      {/* Mobile full-screen sheet */}
      {mobileSheetOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-surface-card md:hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-3">
            <Search size={16} strokeWidth={1.8} className="text-foreground-muted" />
            <input
              ref={sheetInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={PLACEHOLDER}
              aria-label="Search"
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-foreground-muted outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setMobileSheetOpen(false);
                setQuery("");
              }}
              aria-label="Close search"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-ground"
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SearchResultsList
              query={query}
              results={results}
              loading={loading}
              recent={recent}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onSelect={handleSelect}
            />
          </div>
        </div>
      )}
    </>
  );
}
