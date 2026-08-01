"use client";

import React, { useState } from "react";
import { ExpandableTableModal, ExpandTableButton } from "@/components/ExpandableTableModal";

type Props = {
  breakdown: Record<string, number>;
};

export const LocationChart: React.FC<Props> = ({ breakdown }) => {
  const [expanded, setExpanded] = useState(false);
  const data = Object.entries(breakdown || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, clicks], index) => ({ rank: index + 1, name, clicks }));

  const renderTable = (inModal = false) => data.length === 0 ? (
    <div className={`grid place-items-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 ${inModal ? "h-72" : "min-h-0 flex-1"}`}>
      No location data to show.
    </div>
  ) : (
    <div className={`${inModal ? "max-h-[68vh]" : "min-h-0 flex-1"} min-w-0 overflow-auto rounded-lg border border-slate-200`}>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-11 px-3 py-3 sm:w-14 sm:px-4" scope="col">#</th>
            <th className="min-w-0 px-3 py-3 sm:px-4" scope="col">Location</th>
            <th className="w-20 px-3 py-3 text-right sm:w-28 sm:px-4" scope="col">Clicks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((entry) => (
            <tr className="text-slate-700 hover:bg-slate-50" key={entry.name}>
              <td className="px-3 py-3 align-top text-slate-400 sm:px-4">{entry.rank}</td>
              <th className="min-w-0 whitespace-normal break-normal px-3 py-3 text-left font-medium text-slate-950 sm:px-4" scope="row">{entry.name}</th>
              <td className="px-3 py-3 text-right align-top font-medium tabular-nums sm:px-4">{entry.clicks.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="flex h-80 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Location Performance</h2>
          <p className="text-sm text-slate-500">Top 10 locations by clicks</p>
        </div>
        <ExpandTableButton onClick={() => setExpanded(true)} />
      </div>

      {renderTable()}
      <ExpandableTableModal open={expanded} onOpenChange={setExpanded} title="Location Performance" description="Top 10 locations by clicks">
        {renderTable(true)}
      </ExpandableTableModal>
    </section>
  );
};

export default LocationChart;
