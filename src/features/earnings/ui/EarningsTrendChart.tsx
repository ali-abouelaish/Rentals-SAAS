"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { formatGBP } from "@/lib/utils/formatters";
import type { EarningsTrendPoint } from "../domain/types";

export function EarningsTrendChart({ data }: { data: EarningsTrendPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <XAxis dataKey="bucket_date" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(value) => `£${value}`} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value, name) => [
              formatGBP(Number(value)),
              name === "total_earnings" ? "Total" : "Agent"
            ]}
          />
          <Area
            type="monotone"
            dataKey="total_earnings"
            stroke="var(--navy)"
            fill="var(--navy)"
            fillOpacity={0.1}
          />
          <Area
            type="monotone"
            dataKey="agent_earnings"
            stroke="var(--gold)"
            fill="var(--gold)"
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
