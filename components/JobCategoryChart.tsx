// components/JobCategoryChart.tsx
"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
} from "recharts";
import { useMemo } from "react";

// Type of the breakdown prop: { "Product Designer": 16, "Backend Engineer": 5, ... }
type Props = {
  breakdown: Record<string, number>;
};

const COLORS = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#ec4899", // pink
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ef4444", // red
  "#14b8a6", // teal
  "#a3e635", // lime
  "#e5e7eb", // gray
];

// ✅ Custom tooltip so the box always has content and just appears (no slide)
const CustomTooltip = ({
  active,
  payload,
}: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0];
  const name = entry.name as string;
  const value = entry.value as number;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-lg">
      <div className="font-semibold text-slate-50 mb-1">{name}</div>
      <div className="text-slate-300">{value} clicks</div>
    </div>
  );
};

export const JobCategoryChart: React.FC<Props> = ({ breakdown }) => {
  const data = useMemo(() => {
    const entries = Object.entries(breakdown || {});
    const sorted = entries
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Keep chart readable → top N + "Other"
    const TOP_N = 8;
    const top = sorted.slice(0, TOP_N);
    const otherTotal = sorted.slice(TOP_N).reduce((s, t) => s + t.value, 0);

    return otherTotal > 0
      ? [...top, { name: "Other", value: otherTotal }]
      : top;
  }, [breakdown]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold text-slate-100 mb-1">
        Job Category Breakdown
      </h2>
      <p className="text-xs text-slate-400 mb-2">
        Hover a slice to see category and clicks
      </p>

      {/* Chart container */}
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* ⛔ Disable tooltip animation so it just shows */}
            <Tooltip
              isAnimationActive={false}
              content={<CustomTooltip />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={90}
              paddingAngle={3}
              // ⛔ Disable slice animation too (no slide/jump)
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend tags showing what each color means */}
      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        {data.map((entry, index) => (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800"
            key={entry.name}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-slate-200 truncate max-w-[150px]">
              {entry.name} ({entry.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobCategoryChart;
