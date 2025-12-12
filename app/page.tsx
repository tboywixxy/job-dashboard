// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SummaryCards } from "@/components/SummaryCards";
import { TrendChart } from "@/components/TrendChart";
import { TopJobsTable } from "@/components/TopJobsTable";
import { LocationChart } from "@/components/LocationChart";
import { JobCategoryChart } from "@/components/JobCategoryChart";
import {
  fetchRange,
  type RangeResponse,
} from "@/lib/api"; // ⬅️ make sure this path matches your project

type JobPerformer = {
  shortCode: string;
  clicks: number;
  jobTitle: string;
  location: string;
  originalUrl: string;
};

type SummaryData = {
  today: { clicks: number; uniqueUrls: number };
  yesterday: { clicks: number; uniqueUrls: number };
  thisWeek: {
    clicks: number;
    uniqueUrls: number;
    topPerformers: JobPerformer[];
  };
  thisMonth: {
    clicks: number;
    uniqueUrls: number;
    topPerformers: JobPerformer[];
    locationBreakdown?: Record<string, number>;
    jobTitleBreakdown?: Record<string, number>;
  };
};

type WeeklyDay = {
  date: string;
  totalClicks: number;
  uniqueUrls: number;
};

type WeeklyData = {
  totalClicks: number;
  uniqueUrls: number;
  dailyBreakdown: (WeeklyDay & {
    locationBreakdown: Record<string, number>;
    jobTitleBreakdown: Record<string, number>;
    topShortCodes: JobPerformer[];
  })[];
  locationBreakdown: Record<string, number>;
  jobTitleBreakdown: Record<string, number>;
  topPerformers?: JobPerformer[];
};

// Monthly + Range data have same shape as weekly .data
type MonthlyData = WeeklyData;
type RangeData = WeeklyData;

type SelectedRange = "today" | "yesterday" | "thisWeek" | "thisMonth";

export default function Page() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);
  const [selectedRange, setSelectedRange] =
    useState<SelectedRange>("thisWeek");
  const [loading, setLoading] = useState(true);

  // 🔹 Range-specific state
  const [rangeData, setRangeData] = useState<RangeData | null>(null);
  const [usingRange, setUsingRange] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;

        const params = new URLSearchParams({
          year: String(year),
          month: String(month),
        });

        const [summaryRes, weeklyRes, monthlyRes] = await Promise.all([
          fetch("https://jobs.api.mastaskillz.com/analytics/summary"),
          fetch("https://jobs.api.mastaskillz.com/analytics/weekly"),
          fetch(
            `https://jobs.api.mastaskillz.com/analytics/monthly?${params.toString()}`
          ),
        ]);

        const summaryJson = await summaryRes.json();
        const weeklyJson = await weeklyRes.json();
        const monthlyJson = await monthlyRes.json();

        if (summaryJson?.success) {
          setSummary(summaryJson.data);
        }
        if (weeklyJson?.success) {
          setWeekly(weeklyJson.data);
        }
        if (monthlyJson?.success) {
          setMonthly(monthlyJson.data);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // 🔹 Simple ISO strings for today & yesterday
  const todayISO = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const yesterdayISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // 🔹 Apply range button
  const handleApplyRange = async () => {
    setRangeError(null);

    if (!startDate || !endDate) {
      setRangeError("Please select both start and end dates.");
      return;
    }

    if (startDate > endDate) {
      setRangeError("Start date cannot be after end date.");
      return;
    }

    setRangeLoading(true);
    try {
      const res: RangeResponse = await fetchRange(startDate, endDate);

      if (!res.success) {
        setRangeError("Range request failed.");
        setUsingRange(false);
        setRangeData(null);
        return;
      }

      setRangeData(res.data);
      setUsingRange(true);
    } catch (err) {
      console.error("Failed to fetch range analytics:", err);
      setRangeError("Could not load range data. Please try again.");
      setUsingRange(false);
      setRangeData(null);
    } finally {
      setRangeLoading(false);
    }
  };

  // 🔹 Clear range and go back to normal
  const handleClearRange = () => {
    setUsingRange(false);
    setRangeData(null);
    setRangeError(null);
  };

  // 🔹 Trend data — if usingRange, override everything with rangeData
  const trendData = useMemo(() => {
    if (usingRange && rangeData) {
      return rangeData.dailyBreakdown;
    }

    if (!weekly && !monthly) return [];

    if (selectedRange === "today" && weekly) {
      return weekly.dailyBreakdown.filter((d) => d.date === todayISO);
    }

    if (selectedRange === "yesterday" && weekly) {
      return weekly.dailyBreakdown.filter((d) => d.date === yesterdayISO);
    }

    if (selectedRange === "thisWeek" && weekly) {
      return weekly.dailyBreakdown;
    }

    if (selectedRange === "thisMonth") {
      if (monthly) {
        return monthly.dailyBreakdown;
      }
      if (weekly) {
        return weekly.dailyBreakdown;
      }
    }

    return [];
  }, [usingRange, rangeData, weekly, monthly, selectedRange, todayISO, yesterdayISO]);

  // 🔹 Total clicks subtitle — if usingRange, use rangeData.totalClicks
  const totalClicksForSelectedRange = useMemo(() => {
    if (usingRange && rangeData) {
      return rangeData.totalClicks;
    }

    if (!summary) return 0;

    switch (selectedRange) {
      case "today":
        return summary.today.clicks;
      case "yesterday":
        return summary.yesterday.clicks;
      case "thisWeek":
        return summary.thisWeek.clicks;
      case "thisMonth":
        return summary.thisMonth.clicks;
      default:
        return 0;
    }
  }, [usingRange, rangeData, summary, selectedRange]);

  // 🔹 Top jobs — range overrides normal behaviour
  const topJobs: JobPerformer[] = useMemo(() => {
    if (usingRange && rangeData) {
      return rangeData.topPerformers || [];
    }

    if (!summary) return [];

    if (selectedRange === "thisWeek") {
      return summary.thisWeek.topPerformers || [];
    }

    if (selectedRange === "thisMonth") {
      return summary.thisMonth.topPerformers || [];
    }

    if (weekly?.topPerformers) {
      return weekly.topPerformers as JobPerformer[];
    }

    return [];
  }, [usingRange, rangeData, summary, weekly, selectedRange]);

  // 🔹 Location breakdown — range overrides
  const locationBreakdown = useMemo(() => {
    if (usingRange && rangeData) {
      return rangeData.locationBreakdown;
    }

    if (!weekly && !monthly) return {};

    if (selectedRange === "today" || selectedRange === "yesterday") {
      if (weekly) {
        const targetDate =
          selectedRange === "today" ? todayISO : yesterdayISO;
        const day = weekly.dailyBreakdown.find((d) => d.date === targetDate);
        if (day) {
          return day.locationBreakdown;
        }
      }
    }

    if (selectedRange === "thisWeek" && weekly) {
      return weekly.locationBreakdown;
    }

    if (selectedRange === "thisMonth") {
      if (monthly) {
        return monthly.locationBreakdown;
      }
      if (summary?.thisMonth.locationBreakdown) {
        return summary.thisMonth.locationBreakdown;
      }
    }

    if (weekly) return weekly.locationBreakdown;
    if (monthly) return monthly.locationBreakdown;

    return {};
  }, [usingRange, rangeData, weekly, monthly, summary, selectedRange, todayISO, yesterdayISO]);

  // 🔹 Job category breakdown — range overrides
  const jobCategoryBreakdown = useMemo(() => {
    if (usingRange && rangeData) {
      return rangeData.jobTitleBreakdown;
    }

    if (!weekly && !monthly) return {};

    if (selectedRange === "today" || selectedRange === "yesterday") {
      if (weekly) {
        const targetDate =
          selectedRange === "today" ? todayISO : yesterdayISO;
        const day = weekly.dailyBreakdown.find((d) => d.date === targetDate);
        if (day) {
          return day.jobTitleBreakdown;
        }
      }
    }

    if (selectedRange === "thisWeek" && weekly) {
      return weekly.jobTitleBreakdown;
    }

    if (selectedRange === "thisMonth") {
      if (monthly) {
        return monthly.jobTitleBreakdown;
      }
      if (summary?.thisMonth.jobTitleBreakdown) {
        return summary.thisMonth.jobTitleBreakdown;
      }
    }

    if (weekly) return weekly.jobTitleBreakdown;
    if (monthly) return monthly.jobTitleBreakdown;

    return {};
  }, [usingRange, rangeData, weekly, monthly, summary, selectedRange, todayISO, yesterdayISO]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">
              Job Analytics Dashboard
            </h1>
            <p className="text-sm text-slate-400">
              Monitor job clicks, top roles, and location performance.
            </p>
          </div>
        </header>

        {/* 🔹 Date range filter bar */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-slate-400 mb-1">
                Start date
              </label>
              <input
                type="date"
                className="rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-400 mb-1">
                End date
              </label>
              <input
                type="date"
                className="rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApplyRange}
              disabled={rangeLoading}
              className="inline-flex items-center justify-center rounded-md bg-sky-500 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {rangeLoading ? "Applying..." : "Apply range"}
            </button>
            {usingRange && (
              <button
                type="button"
                onClick={handleClearRange}
                className="inline-flex items-center justify-center rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {rangeError && (
          <p className="text-xs text-red-400">{rangeError}</p>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            Loading analytics…
          </div>
        )}

        {!loading && summary && weekly && (
          <>
            <SummaryCards
              summary={summary}
              selectedRange={selectedRange}
              onSelectRange={(r) => {
                // when user clicks a card, exit custom range mode
                setUsingRange(false);
                setRangeData(null);
                setSelectedRange(r);
              }}
            />

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <TrendChart
                  data={trendData}
                  selectedRange={selectedRange}
                  totalClicks={totalClicksForSelectedRange}
                />
              </div>
              <div>
                <LocationChart breakdown={locationBreakdown} />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <TopJobsTable
                  jobs={topJobs}
                  selectedRange={selectedRange}
                />
              </div>
              <div>
                <JobCategoryChart breakdown={jobCategoryBreakdown} />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
