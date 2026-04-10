"use client";

import { useState, useRef, useEffect } from "react";
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
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeName =
    activeAgentId === "all"
      ? "All Agents"
      : agents.find((a) => a.id === activeAgentId)?.name ?? "All Agents";

  const filtered = query
    ? agents.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
    : agents;

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
  }

  // Close on outside click
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

  // Focus search input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
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
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-foreground-muted"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-foreground-muted hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => select("all")}
              className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                activeAgentId === "all"
                  ? "bg-brand/10 text-brand font-semibold"
                  : "text-foreground-secondary hover:bg-surface-inset"
              }`}
            >
              All Agents
            </button>
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => select(a.id)}
                className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                  activeAgentId === a.id
                    ? "bg-brand/10 text-brand font-semibold"
                    : "text-foreground-secondary hover:bg-surface-inset"
                }`}
              >
                {a.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-foreground-muted">No agents found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
