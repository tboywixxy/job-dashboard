// components/TrendChart.tsx
"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type SelectedRange = "today" | "yesterday" | "thisWeek" | "thisMonth";

type TrendPoint = {
  date: string;
  totalClicks: number;
  uniqueUrls: number;
};

type TrendChartProps = {
  data: TrendPoint[];
  selectedRange: SelectedRange;
  totalClicks: number;
};

const formatLabel = (range: SelectedRange) => {
  switch (range) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "thisWeek":
      return "This Week";
    case "thisMonth":
      return "This Month";
    default:
      return "";
  }
};

const formatSubtitle = (range: SelectedRange, totalClicks: number) => {
  const clicksText = `${totalClicks.toLocaleString()} total clicks`;

  switch (range) {
    case "today":
      return `${clicksText} for today`;
    case "yesterday":
      return `${clicksText} for yesterday`;
    case "thisWeek":
      return `${clicksText} in this week`;
    case "thisMonth":
      return `${clicksText} in this month`;
    default:
      return clicksText;
  }
};

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  selectedRange,
  totalClicks,
}) => {
  const titleLabel = formatLabel(selectedRange);
  const subtitle = formatSubtitle(selectedRange, totalClicks);

  const tooltipFormatter = (value: any, name: any) => {
    if (name === "totalClicks") return [`${value} clicks`, "Total Clicks"];
    if (name === "uniqueUrls") return [`${value} URLs`, "Unique URLs"];
    return [value, name];
  };

  const tooltipLabelFormatter = (label: string) => `Date: ${label}`;

  return (
    <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Engagement Trend • {titleLabel}
          </h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickMargin={8}
            width={60}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e5e7eb", marginBottom: 4 }}
            formatter={tooltipFormatter}
            labelFormatter={tooltipLabelFormatter}
          />

          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11, color: "#e5e7eb", paddingBottom: 8 }}
          />

          {/* Total Clicks area */}
          <Area
            type="monotone"
            dataKey="totalClicks"
            name="Total Clicks"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.15}
            strokeWidth={2}
            activeDot={{ r: 5 }}
          />

          {/* Unique URLs area */}
          <Area
            type="monotone"
            dataKey="uniqueUrls"
            name="Unique URLs"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.12}
            strokeWidth={2}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
