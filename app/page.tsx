"use client";
import { BrandLogo } from "@/components/BrandLogo";
import { Skeleton, WorkspaceSkeleton } from "@/components/Skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MobileNavigation } from "@/components/MobileNavigation";
import { FilterBar } from "@/components/FilterBar";
import { ToastNotice } from "@/components/ToastNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gift,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  MessageSquare,
  Users,
  Scale,
  RefreshCw,
  Sun,
  UserCircle,
} from "lucide-react";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { CampaignsPanel } from "@/components/CampaignsPanel";
import { AdminUsersPanel } from "@/components/AdminUsersPanel";
import { LedgerReconciliationPanel } from "@/components/LedgerReconciliationPanel";
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
  ADMIN_SESSION_EVENT,
  clearAdminSession,
  getStoredAdminSession,
  storeAdminSession,
  type AdminSession,
} from "@/lib/adminSession";
import { applyTheme, getInitialTheme, type ThemeMode } from "@/lib/theme";

type SelectedRange = "today" | "yesterday" | "thisWeek" | "thisMonth";
type ActiveView = "dashboard" | "campaigns" | "users" | "ledger" | "reports" | "locations" | "timeline" | "feedback";

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
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

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
    const syncSession = () => setAdminSession(getStoredAdminSession());
    window.addEventListener(ADMIN_SESSION_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener(ADMIN_SESSION_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!adminSession) return;
    const view = new URLSearchParams(window.location.search).get("view");
    if (view === "settings") {
      setActiveView("dashboard");
      window.history.replaceState(null, "", "/?view=dashboard");
      return;
    }
    if (
      view === "dashboard" ||
      view === "campaigns" ||
      view === "reports" ||
      view === "locations" ||
      view === "timeline" ||
      view === "feedback"
      || view === "users"
      || view === "ledger"
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

  const confirmLogout = () => {
    setLogoutDialogOpen(false);
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

  const handleLogout = () => setLogoutDialogOpen(true);

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
    { section: "Overview", view: "dashboard" as const, icon: LayoutDashboard, label: "Dashboard" },
    { section: "Management", view: "campaigns" as const, icon: Gift, label: "Campaigns" },
    { section: "Management", view: "users" as const, icon: Users, label: "Users" },
    { section: "Finance", view: "ledger" as const, icon: Scale, label: "Ledger" },
    { section: "Finance", view: "reports" as const, icon: BarChart3, label: "Reports" },
    { section: "Insights", view: "locations" as const, icon: MapPin, label: "Locations" },
    { section: "Insights", view: "timeline" as const, icon: Clock3, label: "Timeline" },
    { section: "Insights", view: "feedback" as const, icon: MessageSquare, label: "Feedback" },
  ];

  const pageTitle =
    activeView === "feedback" ? "Admin Feedback" :
    activeView === "campaigns" ? "Campaigns & Bonus Credits" :
    activeView === "users" ? "Admin Users" :
    activeView === "ledger" ? "Ledger Reconciliation" :
    activeView === "reports" ? "Reports" :
    activeView === "locations" ? "Location Analytics" :
    activeView === "timeline" ? "Timeline" :
    "Dashboard overview";

  if (!authReady) return <WorkspaceSkeleton />;
  if (!adminSession) return <main className="login-screen"><AdminLoginForm onAuthenticated={handleAuthenticated} /></main>;

  return (
    <main className="admin-workspace min-h-screen">
      <aside className={`admin-sidebar fixed inset-y-0 left-0 z-30 hidden transition-all duration-300 lg:flex lg:flex-col ${sidebarCollapsed ? "w-20 is-collapsed" : "w-64"}`}>
        <div className={`py-5 ${sidebarCollapsed ? "px-4" : "px-5"}`}>
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? "flex-col justify-center" : "justify-between"}`}>
            <BrandLogo compact={sidebarCollapsed} />
            <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className="sidebar-toggle grid h-8 w-8 shrink-0 place-items-center" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-4 py-5 text-sm">
          {(["Overview", "Management", "Finance", "Insights"] as const).map((section) => <div key={section} className="nav-group">
            {!sidebarCollapsed && <p className="nav-section-label">{section}</p>}
            {(adminSession ? navItems.filter((item) => item.section === section) : []).map((item) => {
              const isActive = activeView === item.view;
              return <button key={item.label} type="button" onClick={() => { setActiveView(item.view); window.history.replaceState(null, "", `/?view=${item.view}`); }} aria-current={activeView === item.view ? "page" : undefined} title={sidebarCollapsed ? item.label : undefined} className={`admin-nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${isActive ? "is-active" : ""} ${sidebarCollapsed ? "justify-center" : ""}`}>
                <item.icon className="h-4 w-4" />
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </button>;
            })}
          </div>)}
        </nav>
        <div className={`sidebar-account p-3 ${sidebarCollapsed ? "is-collapsed" : ""}`}>
          {!sidebarCollapsed && <div className="mb-3 flex min-w-0 items-center gap-3 px-2"><UserCircle size={25} /><div className="min-w-0"><p className="truncate text-sm font-medium">{adminSession.displayName}</p><p className="text-xs text-slate-500">Administrator</p></div></div>}
          <button type="button" onClick={handleLogout} className="ui-button logout-button"><LogOut size={16} /><span>Logout</span></button>
        </div>
      </aside>

      <div className={`min-w-0 transition-all duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
      <MobileNavigation title={pageTitle} onRefresh={() => window.location.reload()} items={navItems.map((item) => ({ ...item, href: `/?view=${item.view}`, active: activeView === item.view }))} onNavigate={(href) => { const view = new URLSearchParams(href.split("?")[1]).get("view") as ActiveView; setActiveView(view); window.history.replaceState(null, "", href); }} onLogout={handleLogout} themeMode={themeMode} onToggleTheme={() => setThemeMode((mode) => mode === "dark" ? "light" : "dark")} />
      <header className="admin-header">
          <div className="admin-topbar">
            <div className="admin-topbar-inner mx-auto max-w-[1600px] px-4 sm:px-6 xl:px-8 2xl:px-10">
            <span className="admin-topbar-title">{pageTitle}</span>
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={() => window.location.reload()} className="ui-button desktop-refresh-button" aria-label="Refresh page" title="Refresh page">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setThemeMode((mode) => (mode === "dark" ? "light" : "dark"))} className="ui-button desktop-theme-toggle" aria-label="Toggle theme">
                {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <span className="admin-avatar" aria-hidden="true">{adminSession.displayName.slice(0, 2).toUpperCase()}</span>
              <div className="hidden text-left sm:block"><p className="text-xs font-semibold text-slate-800">{adminSession.displayName}</p><p className="text-[11px] text-slate-500">Administrator</p></div>
            </div>
          </div>
        </div>
        {adminSession && activeView === "dashboard" && (
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 xl:px-8 2xl:px-10">
          <FilterBar label="Date & display" summary={`${activeRangeLabel}${includeTimestamps ? " / Timestamps included" : ""}`}>
          <div className="filter-toolbar-layout">
            <div className="filter-toolbar-scroll">
              <div className="filter-toolbar-fields dashboard-filter-fields">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                    Start date
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="custom-date text-sm font-normal"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                    End date
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="custom-date text-sm font-normal"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={includeTimestamps} onChange={(event) => setIncludeTimestamps(event.target.checked)} className="h-4 w-4 accent-green-600" />Include timestamps</label>
              </div>
            </div>
            <div className="filter-actions">
              <button
                type="button"
                onClick={handleApplyRange}
                disabled={rangeLoading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rangeLoading ? <Skeleton label="Applying range" className="h-4 w-20" /> : "Apply range"}
              </button>
              {usingRange && (
                <button type="button" onClick={handleClearRange} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                  Clear
                </button>
              )}
            </div>
          </div>
          </FilterBar>
        </div>
        )}
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8 2xl:px-10">
        {!authReady && (
          <div className="grid min-h-[420px] place-items-center">
            <Skeleton label="Loading workspace" className="h-40 w-full" />
          </div>
        )}

        {authReady && !adminSession && <AdminLoginForm onAuthenticated={handleAuthenticated} />}

        {authReady && adminSession && (
          <>
        {rangeError && <ToastNotice tone="error" text={rangeError} onClose={() => setRangeError(null)} />}
        {loadError && <ToastNotice tone="error" text={loadError} index={rangeError ? 1 : 0} onClose={() => setLoadError(null)} />}
        {!loading && !summary && !["campaigns", "feedback", "users", "ledger", "dashboard"].includes(activeView) && <div className="surface p-8 text-center"><p className="mb-3 text-sm text-slate-500">Analytics are unavailable.</p><button className="ui-button" onClick={() => void loadAnalytics()}>Retry analytics</button></div>}

        {activeView === "dashboard" && (loading ? (
          <div role="status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><span className="sr-only">Loading analytics</span>{[1,2,3,4].map((item) => <Skeleton key={item} className="h-40 w-full" />)}</div>
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

          </div>
        ) : null)}

        {activeView === "feedback" && <FeedbackPanel token={adminSession.token} />}

        {activeView === "campaigns" && <CampaignsPanel token={adminSession.token} />}
        {activeView === "users" && <AdminUsersPanel token={adminSession.token} />}
        {activeView === "ledger" && <LedgerReconciliationPanel token={adminSession.token} />}

        {activeView === "reports" && (
          <div className="space-y-6">
            <div>
              <TrendChart data={trendData} selectedRange={selectedRange} totalClicks={totalClicks} />
            </div>
            <TopJobsTable jobs={topJobs} />
          </div>
        )}

        {activeView === "locations" && (
          <section className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <LocationChart breakdown={locationBreakdown} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">Location Notes</h2>
              <p className="mt-1 text-sm text-slate-500">Location performance currently reflects job click analytics. Campaign funding is scoped by users, not geography, in the available backend contract.</p>
            </div>
          </section>
        )}

        {activeView === "timeline" && <TrendChart data={trendData} selectedRange={selectedRange} totalClicks={totalClicks} />}


          </>
        )}
      </div>
      </div>
      <ConfirmDialog
        open={logoutDialogOpen}
        title="Sign out of the admin workspace?"
        description="Your current session will be cleared from this browser. You can sign back in at any time."
        confirmLabel="Sign out"
        onClose={() => setLogoutDialogOpen(false)}
        onConfirm={confirmLogout}
      />
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
