"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gift,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Settings,
  UserCircle,
} from "lucide-react";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { CampaignsPanel } from "@/components/CampaignsPanel";
import { JobCategoryChart } from "@/components/JobCategoryChart";
import { LocationChart } from "@/components/LocationChart";
import { SummaryCards } from "@/components/SummaryCards";
import { TopJobsTable } from "@/components/TopJobsTable";
import { TrendChart } from "@/components/TrendChart";
import {
  fetchMonthly,
  fetchRange,
  fetchSummary,
  fetchWeekly,
  type RangeData,
  type SummaryData,
  type TopPerformer,
  type WeeklyData,
} from "@/lib/api";
import {
  clearAdminSession,
  getStoredAdminSession,
  storeAdminSession,
  type AdminSession,
} from "@/lib/adminSession";

type SelectedRange = "today" | "yesterday" | "thisWeek" | "thisMonth";
type ActiveView = "dashboard" | "campaigns" | "reports" | "locations" | "timeline" | "settings";

const rangeLabels: Record<SelectedRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  thisMonth: "This Month",
};

function localDateISO(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Page() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [monthly, setMonthly] = useState<WeeklyData | null>(null);
  const [selectedRange, setSelectedRange] = useState<SelectedRange>("thisWeek");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [includeTimestamps, setIncludeTimestamps] = useState(false);

  const [rangeData, setRangeData] = useState<RangeData | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const todayISO = useMemo(() => localDateISO(), []);
  const yesterdayISO = useMemo(() => localDateISO(-1), []);
  const usingRange = rangeData !== null;

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const now = new Date();
      const [summaryResult, weeklyResult, monthlyResult] = await Promise.all([
        fetchSummary({ timestamps: includeTimestamps }),
        fetchWeekly({ timestamps: includeTimestamps }),
        fetchMonthly(now.getFullYear(), now.getMonth() + 1, { timestamps: includeTimestamps }),
      ]);

      if (!summaryResult.success || !weeklyResult.success || !monthlyResult.success) {
        throw new Error("The analytics service returned an unsuccessful response.");
      }

      setSummary(summaryResult.data);
      setWeekly(weeklyResult.data);
      setMonthly(monthlyResult.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setLoadError("Could not load analytics. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [includeTimestamps]);

  useEffect(() => {
    const savedSession = getStoredAdminSession();
    if (savedSession) setAdminSession(savedSession);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!adminSession) return;
    const view = new URLSearchParams(window.location.search).get("view");
    if (
      view === "dashboard" ||
      view === "campaigns" ||
      view === "reports" ||
      view === "locations" ||
      view === "timeline" ||
      view === "settings"
    ) {
      setActiveView(view);
    }
  }, [adminSession]);

  useEffect(() => {
    if (!adminSession) return;
    void loadAnalytics();
  }, [adminSession, loadAnalytics]);

  const handleAuthenticated = (session: AdminSession) => {
    storeAdminSession(session);
    setAdminSession(session);
  };

  const handleLogout = () => {
    clearAdminSession();
    setAdminSession(null);
    setActiveView("dashboard");
    setSummary(null);
    setWeekly(null);
    setMonthly(null);
    setRangeData(null);
    setLoadError(null);
    setRangeError(null);
  };

  const handleApplyRange = async () => {
    setRangeError(null);

    if (!startDate || !endDate) {
      setRangeError("Select both a start date and an end date.");
      return;
    }

    if (startDate > endDate) {
      setRangeError("Start date cannot be after end date.");
      return;
    }

    setRangeLoading(true);
    try {
      const result = await fetchRange(startDate, endDate, { timestamps: includeTimestamps });
      if (!result.success) throw new Error("Range request failed.");
      setRangeData(result.data);
    } catch (error) {
      console.error("Failed to fetch range analytics:", error);
      setRangeError("Could not load that date range. Please try again.");
    } finally {
      setRangeLoading(false);
    }
  };

  const handleClearRange = () => {
    setStartDate("");
    setEndDate("");
    setRangeData(null);
    setRangeError(null);
  };

  const selectedDay = useMemo(() => {
    if (!weekly || (selectedRange !== "today" && selectedRange !== "yesterday")) {
      return null;
    }

    const targetDate = selectedRange === "today" ? todayISO : yesterdayISO;
    return weekly.dailyBreakdown.find((day) => day.date === targetDate) ?? null;
  }, [selectedRange, todayISO, weekly, yesterdayISO]);

  const trendData = useMemo(() => {
    if (rangeData) return rangeData.dailyBreakdown;
    if (selectedDay) return [selectedDay];
    if (selectedRange === "thisWeek") return weekly?.dailyBreakdown ?? [];
    if (selectedRange === "thisMonth") return monthly?.dailyBreakdown ?? [];
    return [];
  }, [monthly, rangeData, selectedDay, selectedRange, weekly]);

  const totalClicks = useMemo(() => {
    if (rangeData) return rangeData.totalClicks;
    return summary?.[selectedRange].clicks ?? 0;
  }, [rangeData, selectedRange, summary]);

  const topJobs = useMemo<TopPerformer[]>(() => {
    if (rangeData) return rangeData.topPerformers ?? [];
    if (selectedDay) return selectedDay.topShortCodes ?? [];
    if (selectedRange === "thisWeek") {
      return weekly?.topPerformers ?? summary?.thisWeek.topPerformers ?? [];
    }
    if (selectedRange === "thisMonth") {
      return monthly?.topPerformers ?? summary?.thisMonth.topPerformers ?? [];
    }
    return [];
  }, [monthly, rangeData, selectedDay, selectedRange, summary, weekly]);

  const locationBreakdown = useMemo(() => {
    if (rangeData) return rangeData.locationBreakdown ?? {};
    if (selectedDay) return selectedDay.locationBreakdown ?? {};
    if (selectedRange === "thisWeek") return weekly?.locationBreakdown ?? {};
    if (selectedRange === "thisMonth") return monthly?.locationBreakdown ?? {};
    return {};
  }, [monthly, rangeData, selectedDay, selectedRange, weekly]);

  const jobTitleBreakdown = useMemo(() => {
    if (rangeData) return rangeData.jobTitleBreakdown ?? {};
    if (selectedDay) return selectedDay.jobTitleBreakdown ?? {};
    if (selectedRange === "thisWeek") return weekly?.jobTitleBreakdown ?? {};
    if (selectedRange === "thisMonth") return monthly?.jobTitleBreakdown ?? {};
    return {};
  }, [monthly, rangeData, selectedDay, selectedRange, weekly]);

  const topLocation = useMemo(() => {
    const entry = Object.entries(locationBreakdown).sort((a, b) => b[1] - a[1])[0];
    return entry ? { name: entry[0], clicks: entry[1] } : null;
  }, [locationBreakdown]);

  const leadingRole = useMemo(() => {
    const entry = Object.entries(jobTitleBreakdown).sort((a, b) => b[1] - a[1])[0];
    return entry ? { name: entry[0], clicks: entry[1] } : null;
  }, [jobTitleBreakdown]);

  const activeRangeLabel = rangeData
    ? `${startDate} to ${endDate}`
    : rangeLabels[selectedRange];

  const navItems = [
    { view: "dashboard" as const, icon: LayoutDashboard, label: "Dashboard" },
    { view: "campaigns" as const, icon: Gift, label: "Campaigns" },
    { view: "reports" as const, icon: BarChart3, label: "Reports" },
    { view: "locations" as const, icon: MapPin, label: "Locations" },
    { view: "timeline" as const, icon: Clock3, label: "Timeline" },
    { view: "settings" as const, icon: Settings, label: "Settings" },
  ];

  const pageTitle =
    activeView === "campaigns" ? "Campaigns & Bonus Credits" :
    activeView === "reports" ? "Reports" :
    activeView === "locations" ? "Location Analytics" :
    activeView === "timeline" ? "Timeline" :
    activeView === "settings" ? "Settings" : "Job Analytics Dashboard";

  const pageDescription =
    activeView === "campaigns" ? "Create campaigns, fund existing users, reclaim unused bonus credit, and manage paid wallet backup." :
    activeView === "reports" ? "Review campaign and job performance reports from the dashboard workspace." :
    activeView === "locations" ? "Track where job demand and campaign activity are coming from." :
    activeView === "timeline" ? "Inspect daily click movement and timestamp-led engagement patterns." :
    activeView === "settings" ? "Manage dashboard preferences and integration access." :
    "Monitor job clicks, high-performing roles, location demand, and timestamp insights.";

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[#0f3d20] bg-[#14532d] text-white shadow-xl transition-all duration-300 lg:flex lg:flex-col ${sidebarCollapsed ? "w-20" : "w-72"}`}>
        <div className={`border-b border-white/15 py-5 ${sidebarCollapsed ? "px-4" : "px-5"}`}>
          <div className={`flex ${sidebarCollapsed ? "justify-center" : "justify-end"}`}>
            <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/20 text-white/85 transition hover:bg-white/15" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-5 text-sm">
          {(adminSession ? navItems : []).map((item) => {
            const isActive = activeView === item.view;
            return (
              <button key={item.label} type="button" onClick={() => setActiveView(item.view)} title={sidebarCollapsed ? item.label : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${isActive ? "bg-white text-[#48C05C] shadow-sm" : "text-white/80 hover:bg-white/15 hover:text-white"} ${sidebarCollapsed ? "justify-center" : ""}`}>
                <item.icon className="h-4 w-4" />
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/15 px-4 py-4 text-sm">
          {adminSession ? (
            <div className={`flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2.5 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <UserCircle className="h-5 w-5 shrink-0 text-white" />
              {!sidebarCollapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate font-medium" title={adminSession.displayName}>
                    {adminSession.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/80 transition hover:bg-white/15 hover:text-white"
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className={`flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2.5 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <LogIn className="h-5 w-5 shrink-0 text-white" />
              {!sidebarCollapsed && <span className="font-medium">Login</span>}
            </div>
          )}
        </div>
      </aside>

      <div className={`min-w-0 transition-all duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"}`}>
      <nav className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-[#0f3d20] bg-[#14532d] px-3 py-2 text-white shadow-sm lg:hidden" aria-label="Dashboard navigation">
        {adminSession ? navItems.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => setActiveView(item.view)}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-[11px] font-medium transition ${
                isActive ? "bg-white text-[#2f8f42] shadow-sm" : "text-white/80 hover:bg-white/15 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        }) : (
          <button
            type="button"
            aria-current="page"
            className="flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 text-[11px] font-medium text-[#2f8f42] shadow-sm"
          >
            <LogIn className="h-4 w-4" />
            <span>Login</span>
          </button>
        )}
        {adminSession && (
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-[11px] font-medium text-white/80 transition hover:bg-white/15 hover:text-white"
          >
            <UserCircle className="h-4 w-4" />
            <span className="max-w-20 truncate">{adminSession.displayName}</span>
          </button>
        )}
      </nav>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8 2xl:px-10">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {pageTitle}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {pageDescription}
          </p>

          {adminSession && activeView === "dashboard" && (
            <label className="mt-4 flex w-fit items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 select-none">
              <input type="checkbox" checked={includeTimestamps} onChange={(event) => setIncludeTimestamps(event.target.checked)} className="h-4 w-4 accent-[#48C05C]" />
              Include timestamps
            </label>
          )}

          {adminSession && activeView === "dashboard" && (
          <section className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none transition focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none transition focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={handleApplyRange}
                disabled={rangeLoading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${rangeLoading ? "animate-spin" : ""}`} />
                {rangeLoading ? "Applying" : "Apply range"}
              </button>
              {usingRange && (
                <button type="button" onClick={handleClearRange} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                  Clear
                </button>
              )}
            </div>
          </section>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8 2xl:px-10">
        {!authReady && (
          <div className="grid min-h-[420px] place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
          </div>
        )}

        {authReady && !adminSession && <AdminLoginForm onAuthenticated={handleAuthenticated} />}

        {authReady && adminSession && (
          <>
        {activeView === "dashboard" && (rangeError || loadError) && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{rangeError ?? loadError}</span>
            {loadError && (
              <button type="button" onClick={() => void loadAnalytics()} className="font-semibold underline">
                Retry
              </button>
            )}
          </div>
        )}

        {activeView === "dashboard" && (loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading analytics...
          </div>
        ) : summary ? (
          <div className="space-y-6">
            <SummaryCards
              summary={summary}
              selectedRange={selectedRange}
              onSelectRange={(range) => {
                setRangeData(null);
                setRangeError(null);
                setSelectedRange(range);
              }}
            />

            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Active clicks" value={totalClicks.toLocaleString()} detail={activeRangeLabel} />
              <MetricCard
                label="Top location"
                value={topLocation?.name ?? "No data"}
                detail={topLocation ? `${topLocation.clicks.toLocaleString()} clicks` : "Awaiting activity"}
              />
              <MetricCard
                label="Leading role"
                value={leadingRole?.name ?? "No data"}
                detail={leadingRole ? `${leadingRole.clicks.toLocaleString()} clicks` : "Awaiting activity"}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <TrendChart
                  data={trendData}
                  selectedRange={selectedRange}
                  totalClicks={totalClicks}
                />
              </div>
              <LocationChart breakdown={locationBreakdown} />
            </section>

            <section className="space-y-6">
              <TopJobsTable jobs={topJobs} />
              <JobCategoryChart breakdown={jobTitleBreakdown} />
            </section>
          </div>
        ) : null)}

        {activeView === "campaigns" && <CampaignsPanel token={adminSession.token} />}

        {activeView === "reports" && (
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TrendChart data={trendData} selectedRange={selectedRange} totalClicks={totalClicks} />
            </div>
            <JobCategoryChart breakdown={jobTitleBreakdown} />
          </div>
        )}

        {activeView === "locations" && (
          <section className="grid gap-6 xl:grid-cols-3">
            <LocationChart breakdown={locationBreakdown} />
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
              <h2 className="text-base font-semibold">Location Notes</h2>
              <p className="mt-1 text-sm text-slate-500">Location performance currently reflects job click analytics. Campaign funding is scoped by users, not geography, in the available backend contract.</p>
            </div>
          </section>
        )}

        {activeView === "timeline" && <TrendChart data={trendData} selectedRange={selectedRange} totalClicks={totalClicks} />}

        {activeView === "settings" && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Integration Settings</h2>
            <p className="mt-1 text-sm text-slate-500">Campaign tools connect to the Mastaskillz admin service and require an active admin session.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Covered service</p><p className="mt-2 font-semibold">CV improvement</p></div>
              <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid wallet backup</p><p className="mt-2 font-semibold">User controlled</p></div>
            </div>
          </section>
        )}
          </>
        )}
      </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold text-slate-950" title={value}>
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
