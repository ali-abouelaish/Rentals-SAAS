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
  className
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

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-xl border border-muted bg-card p-1", className)}>
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  children,
  className
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
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium",
        active ? "bg-navy text-white" : "text-gray-600 hover:bg-muted",
        className
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({
  value,
  children
}: {
  value: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;
  return <div>{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
