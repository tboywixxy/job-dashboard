// components/JobDetailsModal.tsx
"use client";

import React, { useMemo } from "react";
import { X } from "lucide-react";

type Job = {
  shortCode: string;
  jobTitle: string;
  location: string;
  clicks: number;
  originalUrl: string;
  firstClickAt?: string;
  lastClickAt?: string;
  timestamps?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  job: Job | null;
};

function fmtLocal(ts?: string) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
  } catch {
    return ts;
  }
}

export const JobDetailsModal: React.FC<Props> = ({ open, onClose, job }) => {
  const derived = useMemo(() => {
    const ts = job?.timestamps || [];
    if (!job || ts.length === 0) {
      return {
        hours: [] as { hour: string; count: number }[],
        days: [] as { day: string; count: number }[],
        avgIntervalMinutes: null as number | null,
      };
    }

    const dates = ts
      .map((t) => new Date(t))
      .filter((d) => !Number.isNaN(d.getTime()));

    const hourMap = new Map<number, number>();
    for (const d of dates) {
      const hour = Number(
        d.toLocaleString("en-NG", {
          timeZone: "Africa/Lagos",
          hour: "2-digit",
          hour12: false,
        })
      );
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    }

    const hours = [...hourMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([h, c]) => ({ hour: `${String(h).padStart(2, "0")}:00`, count: c }));

    const dayMap = new Map<string, number>();
    for (const d of dates) {
      const day = d.toLocaleString("en-NG", {
        timeZone: "Africa/Lagos",
        weekday: "short",
      });
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }

    const days = [...dayMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([day, count]) => ({ day, count }));

    const intervals: number[] = [];
    for (let i = 0; i < dates.length - 1; i++) {
      const diffMin = (dates[i].getTime() - dates[i + 1].getTime()) / 1000 / 60;
      if (diffMin >= 0) intervals.push(diffMin);
    }

    const avgIntervalMinutes =
      intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : null;

    return { hours, days, avgIntervalMinutes };
  }, [job]);

  if (!open || !job) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      <div className="absolute left-1/2 top-1/2 max-h-[90vh] w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-950">
              {job.jobTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {job.location || "-"} · {job.clicks.toLocaleString()} clicks · {job.shortCode}
            </p>
          </div>

          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-74px)] space-y-4 overflow-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                First click (Lagos)
              </div>
              <div className="text-sm text-slate-950">{fmtLocal(job.firstClickAt)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Last click (Lagos)
              </div>
              <div className="text-sm text-slate-950">{fmtLocal(job.lastClickAt)}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Original URL
            </div>
            <a
              href={job.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm font-medium text-[#2f8f42] hover:underline"
            >
              {job.originalUrl}
            </a>
          </div>

          {!job.timestamps || job.timestamps.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No timestamps returned. Turn on &quot;Include timestamps&quot; and re-fetch.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-sm font-semibold">Top hours (Lagos)</div>
                <div className="space-y-2 text-sm text-slate-700">
                  {derived.hours.slice(0, 6).map((h) => (
                    <div key={h.hour} className="flex justify-between">
                      <span>{h.hour}</span>
                      <span className="font-medium text-slate-950">{h.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-sm font-semibold">Top days (Lagos)</div>
                <div className="space-y-2 text-sm text-slate-700">
                  {derived.days.slice(0, 6).map((d) => (
                    <div key={d.day} className="flex justify-between">
                      <span>{d.day}</span>
                      <span className="font-medium text-slate-950">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-sm font-semibold">Click velocity</div>
                <p className="text-sm text-slate-500">Avg time between clicks</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {derived.avgIntervalMinutes == null
                    ? "-"
                    : `${derived.avgIntervalMinutes.toFixed(1)} mins`}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Based on returned timestamps.
                </p>
              </div>
            </div>
          )}

          {job.timestamps && job.timestamps.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Raw timestamps</div>
                <div className="text-xs text-slate-500">
                  {job.timestamps.length} items
                </div>
              </div>
              <div className="max-h-48 space-y-1 overflow-auto text-xs text-slate-600">
                {job.timestamps.slice(0, 200).map((t) => (
                  <div key={t}>
                    {fmtLocal(t)} <span className="text-slate-400">({t})</span>
                  </div>
                ))}
                {job.timestamps.length > 200 && (
                  <div className="text-slate-500">Showing first 200...</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobDetailsModal;
