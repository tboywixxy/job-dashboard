// components/TopJobsTable.tsx
"use client";

import React, { useMemo, useState } from "react";
import { ArrowDownUp, ExternalLink, Info, Search } from "lucide-react";
import JobDetailsModal from "@/components/JobDetailsModal";
import { ExpandableTableModal, ExpandTableButton } from "@/components/ExpandableTableModal";

type JobRow = {
  shortCode: string;
  jobTitle: string;
  location: string;
  clicks: number;
  originalUrl: string;
  firstClickAt?: string;
  lastClickAt?: string;
  timestamps?: string[];
};

type TopJobsTableProps = {
  jobs: JobRow[];
};

const fmtLocal = (ts?: string) => {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
  } catch {
    return ts;
  }
};

export const TopJobsTable: React.FC<TopJobsTableProps> = ({ jobs }) => {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"clicks" | "location">("clicks");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<JobRow | null>(null);

  const handleSort = (key: "clicks" | "location") => {
    if (sortKey === key) setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDirection(key === "clicks" ? "desc" : "asc");
    }
  };

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const lower = search.toLowerCase();
    return jobs.filter(
      (j) =>
        j.jobTitle.toLowerCase().includes(lower) ||
        j.location.toLowerCase().includes(lower) ||
        j.shortCode.toLowerCase().includes(lower)
    );
  }, [jobs, search]);

  const sortedJobs = useMemo(() => {
    const copy = [...filteredJobs];
    copy.sort((a, b) => {
      const aVal = sortKey === "clicks" ? a.clicks : (a.location || "").toLowerCase();
      const bVal = sortKey === "clicks" ? b.clicks : (b.location || "").toLowerCase();

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

  const handleDetails = (job: JobRow) => {
    setSelected(job);
    setOpen(true);
  };

  return (
    <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Top Performing Jobs
          </h2>
          <p className="text-sm text-slate-500">
            Search, sort, and inspect timestamp analytics.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, location, shortcode"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10"
            />
          </div>
          <ExpandTableButton onClick={() => setExpanded(true)} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 md:hidden" aria-label="Sort jobs"><button type="button" className="ui-button" onClick={() => handleSort("clicks")}>Clicks {sortKey === "clicks" ? (sortDirection === "desc" ? "?" : "?") : ""}</button><button type="button" className="ui-button" onClick={() => handleSort("location")}>Location {sortKey === "location" ? (sortDirection === "desc" ? "?" : "?") : ""}</button></div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="jobs-list-scroll max-h-96 overflow-auto">
          <table className="mobile-card-table min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Job Title
                </th>

                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  onClick={() => handleSort("location")}
                >
                  <button className="inline-flex items-center gap-1" type="button">
                    Location <ArrowDownUp className="h-3.5 w-3.5" />
                  </button>
                </th>

                <th
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                  onClick={() => handleSort("clicks")}
                >
                  <button className="ml-auto inline-flex items-center gap-1" type="button">
                    Clicks <ArrowDownUp className="h-3.5 w-3.5" />
                  </button>
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  First click
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last click
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No jobs found for this search.
                  </td>
                </tr>
              ) : (
                sortedJobs.map((job) => (
                  <tr key={job.shortCode} className="transition hover:bg-slate-50">
                    <td data-label="Job" className="px-4 py-3 align-top">
                      <div className="min-w-56">
                        <span className="font-medium text-slate-950">{job.jobTitle}</span>
                        <span className="mt-1 block text-xs text-slate-400">
                          {job.shortCode}
                        </span>
                      </div>
                    </td>

                    <td data-label="Location" className="px-4 py-3 align-top text-slate-600">
                      {job.location || "-"}
                    </td>

                    <td data-label="Clicks" className="px-4 py-3 align-top text-right">
                      <span className="inline-flex rounded-full bg-[#48C05C]/10 px-2.5 py-1 text-xs font-semibold text-[#2f8f42]">
                        {job.clicks.toLocaleString()}
                      </span>
                    </td>

                    <td data-label="First click" className="px-4 py-3 align-top text-xs text-slate-500">
                      {fmtLocal(job.firstClickAt)}
                    </td>

                    <td data-label="Last click" className="px-4 py-3 align-top text-xs text-slate-500">
                      {fmtLocal(job.lastClickAt)}
                    </td>

                    <td data-label="Actions" className="px-4 py-3 align-top text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleViewJob(job.originalUrl)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#48C05C]/40 hover:text-[#48C05C]"
                          title="Open job"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDetails(job)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#48C05C]/40 hover:text-[#48C05C]"
                          title="View details"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpandableTableModal
        open={expanded}
        onOpenChange={setExpanded}
        title="Top Performing Jobs"
        description={`${sortedJobs.length.toLocaleString()} matching jobs. Search, sort, and inspect timestamp analytics.`}
      >
        <div className="relative mb-4 w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, location, shortcode" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10" />
        </div>
        <div className="max-h-[68vh] overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Job Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><button type="button" onClick={() => handleSort("location")} className="inline-flex items-center gap-1">Location <ArrowDownUp className="h-3.5 w-3.5" /></button></th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"><button type="button" onClick={() => handleSort("clicks")} className="ml-auto inline-flex items-center gap-1">Clicks <ArrowDownUp className="h-3.5 w-3.5" /></button></th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">First click</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Last click</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedJobs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No jobs found for this search.</td></tr>
              ) : sortedJobs.map((job) => (
                <tr key={job.shortCode} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><span className="font-medium text-slate-950">{job.jobTitle}</span><span className="mt-1 block text-xs text-slate-400">{job.shortCode}</span></td>
                  <td className="px-4 py-3 text-slate-600">{job.location || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#2f8f42]">{job.clicks.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtLocal(job.firstClickAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtLocal(job.lastClickAt)}</td>
                  <td className="px-4 py-3 text-right"><div className="inline-flex gap-2"><button type="button" onClick={() => handleViewJob(job.originalUrl)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200" title="Open job"><ExternalLink className="h-4 w-4" /></button><button type="button" onClick={() => handleDetails(job)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200" title="View details"><Info className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ExpandableTableModal>
      <JobDetailsModal open={open} job={selected} onClose={() => setOpen(false)} />
    </div>
  );
};

export default TopJobsTable;
