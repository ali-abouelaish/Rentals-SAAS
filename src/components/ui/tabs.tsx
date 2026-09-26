"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

/**
 * Scrolls sideways rather than overflowing the page.
 *
 * This was `inline-flex` with no wrap and no scroll, so a strip of four or more
 * tabs pushed the whole document wider than a phone screen — the tabs stayed
 * unreachable and every other page element gained a horizontal scrollbar.
 * `flex` + `overflow-x-auto` contains it, and the triggers stop shrinking so
 * their labels do not concertina.
 */
function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
        "rounded-xl border border-border bg-surface-inset p-1 shadow-xs",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:inline-flex sm:max-w-none sm:overflow-visible",
        className
      )}
    >
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "flex shrink-0 snap-start items-center whitespace-nowrap rounded-lg px-4 py-2",
        "min-h-11 text-sm font-medium transition-all duration-base sm:min-h-0",
        active
          ? "bg-brand text-brand-fg shadow-md"
          : "text-foreground-secondary hover:bg-surface-card hover:text-foreground hover:shadow-sm",
        className
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
