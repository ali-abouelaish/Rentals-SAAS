import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { FilterActions, FilterBar, FilterGroup, FilterRow } from "@/components/ui/filter-bar";
import { getSystemHealth } from "@/features/admin/data/health";
import { SystemHealthPanel } from "@/features/admin/ui/SystemHealthPanel";

const WINDOWS = [
  { value: "24", label: "Last 24 hours" },
  { value: "72", label: "Last 3 days" },
  { value: "168", label: "Last 7 days" },
  { value: "720", label: "Last 30 days" }
];

export default async function AdminHealthPage({
  searchParams
}: {
  searchParams?: { window?: string };
}) {
  const requested = Number(searchParams?.window);
  const windowHours = Number.isFinite(requested) && requested > 0 ? requested : 24;

  const health = await getSystemHealth({ windowHours });

  return (
    <div className="space-y-5">
      <PageHeader
        title="System Health"
        subtitle="Recurring job outcomes, integration failures and mailbox problems across every agency."
      />

      <FilterBar>
        <form method="get">
          <FilterRow>
            <FilterGroup label="Window">
              <select
                name="window"
                defaultValue={String(health.windowHours)}
                className="flex h-10 rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground-secondary min-w-[200px]"
              >
                {WINDOWS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterActions>
              <Button type="submit" variant="outline" size="sm">
                Apply
              </Button>
            </FilterActions>
          </FilterRow>
        </form>
      </FilterBar>

      <SystemHealthPanel health={health} />
    </div>
  );
}
