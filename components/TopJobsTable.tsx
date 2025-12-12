"use client";

import React, { useMemo, useState } from "react";

type JobRow = {
  shortCode: string;
  jobTitle: string;
  location: string;
  clicks: number;
  originalUrl: string;
};

type TopJobsTableProps = {
  jobs: JobRow[];
};

// 🔹 Export ALL jobs (not just visible table) to CSV with full details
const exportJobsToCSV = (jobs: JobRow[]) => {
  if (!jobs || jobs.length === 0) return;

  const headers = [
    "Job Title",
    "Location",
    "Clicks",
    "Shortcode",
    "Original URL",
  ];

  const rows = jobs.map((j) => [
    j.jobTitle,
    j.location,
    j.clicks.toString(),
    j.shortCode,
    j.originalUrl,
  ]);

  const csvLines = [
    headers.join(","),
    // escape commas / quotes in fields
    ...rows.map((cols) =>
      cols
        .map((val) => {
          const v = String(val ?? "");
          if (v.includes(",") || v.includes('"') || v.includes("\n")) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        })
        .join(",")
    ),
  ];

  const csvContent = csvLines.join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "job_analytics_export.csv";
  a.click();
  URL.revokeObjectURL(url);
};

// 🔹 Simple PDF-like export using browser print (includes all job details)
const exportJobsToPDF = (jobs: JobRow[]) => {
  if (!jobs || jobs.length === 0) return;

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`
    <html>
      <head>
        <title>Job Analytics Export</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            padding: 16px;
            color: #0f172a;
          }
          h1 { font-size: 20px; margin-bottom: 12px; }
          h2 { font-size: 16px; margin-top: 20px; margin-bottom: 6px; }
          p { font-size: 13px; margin: 2px 0; }
          .job-card { border-bottom: 1px solid #cbd5f5; padding: 8px 0; }
        </style>
      </head>
      <body>
        <h1>Job Analytics Export</h1>
        <p>Total jobs: ${jobs.length}</p>
        <hr />
        ${jobs
          .map(
            (j, idx) => `
            <div class="job-card">
              <h2>${idx + 1}. ${j.jobTitle}</h2>
              <p><b>Location:</b> ${j.location}</p>
              <p><b>Clicks:</b> ${j.clicks}</p>
              <p><b>Shortcode:</b> ${j.shortCode}</p>
              <p><b>Original URL:</b> ${j.originalUrl}</p>
            </div>
          `
          )
          .join("")}
      </body>
    </html>
  `);

  win.document.close();
  win.focus();
  win.print();
};

type SortKey = "clicks" | "location";
type SortDirection = "asc" | "desc";

export const TopJobsTable: React.FC<TopJobsTableProps> = ({ jobs }) => {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // 🔁 handle sort changes
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // toggle current direction
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // default: clicks → desc, location → asc
      setSortDirection(key === "clicks" ? "desc" : "asc");
    }
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return (
      <span className="ml-1 text-[10px] text-slate-400">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  // 🔎 Filter by job title or location
  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;

    const lower = search.toLowerCase();
    return jobs.filter(
      (j) =>
        j.jobTitle.toLowerCase().includes(lower) ||
        j.location.toLowerCase().includes(lower)
    );
  }, [jobs, search]);

  // ⬆️⬇️ Sort by selected key (clicks or location)
  const sortedJobs = useMemo(() => {
    const copy = [...filteredJobs];

    copy.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortKey === "clicks") {
        aVal = a.clicks;
        bVal = b.clicks;
      } else {
        aVal = a.location.toLowerCase();
        bVal = b.location.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return copy;
  }, [filteredJobs, sortKey, sortDirection]);

  const handleViewJob = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Top Performing Jobs
          </h2>
          <p className="text-xs text-slate-400">
            Sorted by clicks or location. Use search to filter.
          </p>
        </div>

        {/* 🔍 Search + Export */}
        <div className="flex flex-1 sm:flex-none gap-2 items-center justify-end">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or location..."
            className="w-full sm:w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* 📤 Export Buttons → ALL jobs, not just filtered */}
          <button
            onClick={() => exportJobsToCSV(jobs)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-[11px] text-slate-200 border border-slate-700 hover:bg-slate-700"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportJobsToPDF(jobs)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-[11px] text-slate-200 border border-slate-700 hover:bg-slate-700"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* 🔁 Scrollable table container (fixed height) */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-72 overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/80 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">
                Job Title
              </th>
              <th
                className="px-3 py-2 text-left text-xs font-semibold text-slate-400 cursor-pointer select-none"
                onClick={() => handleSort("location")}
                title="Click to sort by location"
              >
                Location
                {renderSortIndicator("location")}
              </th>
              <th
                className="px-3 py-2 text-right text-xs font-semibold text-slate-400 cursor-pointer select-none"
                onClick={() => handleSort("clicks")}
                title="Click to sort by clicks"
              >
                Clicks
                {renderSortIndicator("clicks")}
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60">
            {sortedJobs.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-center text-xs text-slate-500"
                >
                  No jobs found for this search.
                </td>
              </tr>
            ) : (
              sortedJobs.map((job) => (
                <tr key={job.shortCode} className="hover:bg-slate-900/60">
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col">
                      <span className="text-slate-100 text-sm">
                        {job.jobTitle}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Shortcode: {job.shortCode}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-200">
                    {job.location || "—"}
                  </td>
                  <td className="px-3 py-2 align-top text-right text-slate-100">
                    {job.clicks}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      onClick={() => handleViewJob(job.originalUrl)}
                      className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Tip: Export buttons include{" "}
        <span className="font-semibold text-slate-300">
          all available jobs with full details
        </span>
        , not just the ones currently visible in the table.
      </p>
    </div>
  );
};

export default TopJobsTable;
