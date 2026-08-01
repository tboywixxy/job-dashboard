// components/TrendChart.tsx
"use client";

import React, { useState } from "react";
import { ExpandableTableModal, ExpandTableButton } from "@/components/ExpandableTableModal";

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
      return `${clicksText} this week`;
    case "thisMonth":
      return `${clicksText} this month`;
    default:
      return clicksText;
  }
};

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  selectedRange,
  totalClicks,
}) => {
  const [expanded, setExpanded] = useState(false);
  const titleLabel = formatLabel(selectedRange);
  const subtitle = formatSubtitle(selectedRange, totalClicks);

  const renderTable = (inModal = false) => data.length === 0 ? (
    <div className={`grid place-items-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 ${inModal ? "h-72" : "h-56"}`}>
      No engagement data to show.
    </div>
  ) : (
    <div className={`${inModal ? "max-h-[68vh]" : "max-h-56"} overflow-auto rounded-lg border border-slate-200`}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3" scope="col">Date</th>
            <th className="px-4 py-3 text-right" scope="col">Total clicks</th>
            <th className="px-4 py-3 text-right" scope="col">Unique URLs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((entry, index) => (
            <tr className="text-slate-700 hover:bg-slate-50" key={`${entry.date}-${index}`}>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-950" scope="row">{entry.date}</th>
              <td className="px-4 py-3 text-right tabular-nums">{entry.totalClicks.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums">{entry.uniqueUrls.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="h-80 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Engagement Activity - {titleLabel}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <ExpandTableButton onClick={() => setExpanded(true)} />
      </div>

      {renderTable()}
      <ExpandableTableModal open={expanded} onOpenChange={setExpanded} title={`Engagement Activity - ${titleLabel}`} description={subtitle}>
        {renderTable(true)}
      </ExpandableTableModal>
    </section>
  );
};

export default TrendChart;
