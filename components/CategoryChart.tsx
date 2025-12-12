"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type Props = {
  breakdown: Record<string, number>;
};

export const CategoryChart: React.FC<Props> = ({ breakdown }) => {
  const entries = Object.entries(breakdown || {});
  const data = entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, clicks]) => ({ name, value: clicks }));

  // simple palette – Recharts will use default if we skip, but we can give few
  const colors = [
    "#22c55e",
    "#0ea5e9",
    "#a855f7",
    "#f97316",
    "#facc15",
    "#e11d48",
    "#06b6d4",
    "#4ade80",
    "#3b82f6",
    "#6366f1",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
    "#8b5cf6",
    "#84cc16",
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold text-slate-100 mb-3">
        Job Category / Title Breakdown (Top 15)
      </h2>
      {data.length === 0 ? (
        <p className="text-xs text-slate-400">No data to show.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                innerRadius={40}
                paddingAngle={1}
              >
                {data.map((entry, idx) => (
                  <Cell key={entry.name} fill={colors[idx % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#020617",
                  borderColor: "#1f2937",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500">
        Showing top 15 roles by clicks for the selected period.
      </p>
    </div>
  );
};
