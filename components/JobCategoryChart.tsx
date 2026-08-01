// components/JobCategoryChart.tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useMemo } from "react";

type Props = {
  breakdown: Record<string, number>;
};

const COLORS = [
  "#48C05C",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
  "#6366f1",
  "#14b8a6",
  "#a855f7",
  "#84cc16",
  "#ef4444",
  "#64748b",
];

type TooltipEntry = {
  name?: string;
  value?: number;
};

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0];
  const name = entry.name ?? "Unknown";
  const value = entry.value ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-xl">
      <div className="mb-1 font-semibold text-slate-950">{name}</div>
      <div>{value.toLocaleString()} clicks</div>
    </div>
  );
};

export const JobCategoryChart: React.FC<Props> = ({ breakdown }) => {
  const data = useMemo(() => {
    const sorted = Object.entries(breakdown || {})
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const top = sorted.slice(0, 8);
    const otherTotal = sorted.slice(8).reduce((sum, item) => sum + item.value, 0);

    return otherTotal > 0
      ? [...top, { name: "Other", value: otherTotal }]
      : top;
  }, [breakdown]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-950">
          Job Category Breakdown
        </h2>
        <p className="text-sm text-slate-500">Role mix by click activity</p>
      </div>

      {data.length === 0 ? (
        <div className="mt-4 grid h-60 place-items-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
          No category data to show.
        </div>
      ) : (
        <>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip isAnimationActive={false} content={<CustomTooltip />} />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={46}
                  outerRadius={90}
                  paddingAngle={3}
                  isAnimationActive={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {data.map((entry, index) => (
              <div
                className="flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700"
                key={entry.name}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="max-w-40 truncate">
                  {entry.name} ({entry.value.toLocaleString()})
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default JobCategoryChart;
