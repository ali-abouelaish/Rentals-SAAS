"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  error,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(
    () =>
      search.trim()
        ? options.filter(
            (o) =>
              o.label.toLowerCase().includes(search.toLowerCase()) ||
              o.sublabel?.toLowerCase().includes(search.toLowerCase())
          )
        : options,
    [options, search]
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      const initial = filtered.findIndex((o) => o.value === value);
      setActiveIndex(initial >= 0 ? initial : 0);
    } else {
      setSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length > 0 ? 0 : -1);
    }
  }, [filtered.length, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function commitActive() {
    const opt = filtered[activeIndex];
    if (opt) {
      onChange(opt.value);
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  function handleListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length === 0 ? -1 : (i + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0 ? -1 : (i - 1 + filtered.length) % filtered.length
      );
    } else if (e.key === "Home") {
      e.preventDefault();
      if (filtered.length > 0) setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      if (filtered.length > 0) setActiveIndex(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitActive();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            if (!open) {
              e.preventDefault();
              setOpen(true);
            }
            return;
          }
          if (
            !open &&
            e.key.length === 1 &&
            !e.metaKey &&
            !e.ctrlKey &&
            !e.altKey &&
            /\S/.test(e.key)
          ) {
            e.preventDefault();
            setSearch(e.key);
            setOpen(true);
          }
        }}
        className={cn(
          "h-9 w-full rounded-lg border bg-surface-inset px-3 text-sm text-left flex items-center justify-between gap-2",
          "focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors",
          error ? "border-red-400" : "border-border",
          !selected ? "text-foreground-muted" : "text-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-xl border border-border bg-surface-card shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleListKey}
                placeholder="Search…"
                className="h-8 w-full rounded-lg border border-border bg-surface-inset pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          </div>

          <div ref={listRef} className="max-h-56 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-foreground-muted">No results</p>
            ) : (
              filtered.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  data-idx={idx}
                  role="option"
                  aria-selected={opt.value === value}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                    idx === activeIndex && "bg-surface-inset",
                    opt.value === value && "bg-brand/5"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{opt.label}</p>
                    {opt.sublabel && (
                      <p className="text-[11px] text-foreground-muted truncate">{opt.sublabel}</p>
                    )}
                  </div>
                  {opt.value === value && (
                    <Check className="h-3.5 w-3.5 text-brand shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
