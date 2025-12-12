"use client";

import React from "react";
import type { TimeRange } from "@/lib/api";
import clsx from "clsx";

const ranges: { id: TimeRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "thisWeek", label: "This Week" },
  { id: "thisMonth", label: "This Month" },
];

type Props = {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
};

export const TimeRangeTabs: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="inline-flex rounded-xl bg-slate-900/70 p-1 border border-slate-800">
      {ranges.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className={clsx(
            "px-4 py-1.5 text-sm font-medium rounded-lg transition",
            value === r.id
              ? "bg-emerald-500 text-slate-950 shadow"
              : "text-slate-300 hover:bg-slate-800"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
};
