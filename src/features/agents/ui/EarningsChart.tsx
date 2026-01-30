"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import { formatCurrency } from "@/lib/utils/formatters";

export function EarningsChart({
  data
}: {
  data: { date: string; earnings: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(value) => `£${value}`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Line type="monotone" dataKey="earnings" stroke="#1C2A39" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
