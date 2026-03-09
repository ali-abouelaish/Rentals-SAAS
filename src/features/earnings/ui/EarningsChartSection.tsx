"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { formatGBP } from "@/lib/utils/formatters";
import type { EarningsTrendPoint, EarningsLeaderboardRow } from "../domain/types";

const COLORS = ["#14213d", "#E2B808", "#0d9488", "#6366f1"];

type TrendByAgentsPoint = EarningsTrendPoint & { by_agent: Record<string, number> };

export function EarningsChartSection({
  trend,
  trendByAgents,
  topAgents
}: {
  trend: EarningsTrendPoint[];
  trendByAgents: TrendByAgentsPoint[];
  topAgents: EarningsLeaderboardRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "compare" ? "compare" : "total";

  const setView = (v: "total" | "compare") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.push(`/earnings?${params.toString()}`);
  };

  const compareData = trendByAgents.map((p) => {
    const out: Record<string, string | number> = { bucket_date: p.bucket_date };
    topAgents.slice(0, 3).forEach((a, i) => {
      out[a.agent_id] = p.by_agent[a.agent_id] ?? 0;
    });
    return out;
  });

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-50">
            <span className="text-lg">📈</span>
          </div>
          <h2 className="text-base font-semibold text-foreground">Earnings Over Time</h2>
        </div>
        <div className="flex rounded-lg border border-border bg-surface-inset p-0.5">
          <button
            type="button"
            onClick={() => setView("total")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === "total"
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            Total
          </button>
          <button
            type="button"
            onClick={() => setView("compare")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === "compare"
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            Compare Agents
          </button>
        </div>
      </div>

      {view === "total" ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <XAxis dataKey="bucket_date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [formatGBP(Number(value)), "Agency total"]}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="total_earnings"
                stroke="#14213d"
                fill="#14213d"
                fillOpacity={0.1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={compareData}>
              <XAxis dataKey="bucket_date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [
                  formatGBP(Number(value)),
                  topAgents.find((a) => a.agent_id === name)?.agent_name ?? name
                ]}
              />
              <Legend
                formatter={(value) =>
                  topAgents.find((a) => a.agent_id === value)?.agent_name ?? value
                }
              />
              {topAgents.slice(0, 3).map((a, i) => (
                <Line
                  key={a.agent_id}
                  type="monotone"
                  dataKey={a.agent_id}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={a.agent_id}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
