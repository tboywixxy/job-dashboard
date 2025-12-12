"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = {
  breakdown: Record<string, number>;
};

export const LocationChart: React.FC<Props> = ({ breakdown }) => {
  const entries = Object.entries(breakdown || {});
  // take top 10 locations by clicks
  const data = entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, clicks]) => ({ name, clicks }));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold text-slate-100 mb-3">
        Location Performance (Top 10)
      </h2>
      {data.length === 0 ? (
        <p className="text-xs text-slate-400">No data to show.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -20 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#cbd5f5" }}
                interval={0}
                height={60}
                angle={-30}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 10, fill: "#cbd5f5" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#020617",
                  borderColor: "#1f2937",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#e5e7eb" }}
                itemStyle={{ color: "#e5e7eb" }}
              />
              {/* 🔹 Bars themselves now WHITE */}
              <Bar
                dataKey="clicks"
                fill="#ffffff"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default LocationChart;
