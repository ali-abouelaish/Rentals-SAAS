"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Search, X } from "lucide-react";

type Agent = { id: string; name: string };

export function AgentFilterDropdown({
  agents,
  activeAgentId,
}: {
  agents: Agent[];
  activeAgentId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeName =
    activeAgentId === "all"
      ? "All Agents"
      : agents.find((a) => a.id === activeAgentId)?.name ?? "All Agents";

  const filtered = useMemo(
    () =>
      query
        ? agents.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
        : agents,
    [agents, query]
  );

  // Items: [0] = "All Agents" (only when no query), then filtered agents.
  const items = useMemo<Array<{ id: string; name: string }>>(
    () =>
      query
        ? filtered
        : [{ id: "all", name: "All Agents" }, ...filtered],
    [filtered, query]
  );

  function select(agentId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (agentId === "all") {
      params.delete("agent");
    } else {
      params.set("agent", agentId);
    }
    params.set("page", "1");
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      const initial = items.findIndex(
        (it) => it.id === (activeAgentId === "all" ? "all" : activeAgentId)
      );
      setActiveIndex(initial >= 0 ? initial : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(items.length > 0 ? 0 : -1);
    }
  }, [items.length, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function handleListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (items.length === 0 ? -1 : (i + 1) % items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        items.length === 0 ? -1 : (i - 1 + items.length) % items.length
      );
    } else if (e.key === "Home") {
      e.preventDefault();
      if (items.length > 0) setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      if (items.length > 0) setActiveIndex(items.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[activeIndex];
      if (it) select(it.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
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
            setQuery(e.key);
            setOpen(true);
          }
        }}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:border-brand transition-colors"
      >
        <span className="truncate max-w-[140px]">{activeName}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-surface-card shadow-lg overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-foreground-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search agents..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleListKey}
              className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-foreground-muted"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-foreground-muted hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Options */}
          <div ref={listRef} className="max-h-52 overflow-y-auto py-1" role="listbox">
            {items.length === 0 ? (
              <p className="px-3 py-2 text-xs text-foreground-muted">No agents found</p>
            ) : (
              items.map((it, idx) => {
                const isActiveItem =
                  activeAgentId === it.id || (it.id === "all" && activeAgentId === "all");
                const isHighlighted = idx === activeIndex;
                return (
                  <button
                    key={it.id}
                    type="button"
                    data-idx={idx}
                    role="option"
                    aria-selected={isActiveItem}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => select(it.id)}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                      isActiveItem
                        ? "bg-brand/10 text-brand font-semibold"
                        : isHighlighted
                          ? "bg-surface-inset text-foreground-secondary"
                          : "text-foreground-secondary hover:bg-surface-inset"
                    }`}
                  >
                    {it.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
