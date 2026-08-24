"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
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
  Moon,
  Plus,
  Settings,
  Sun,
  UserCircle,
} from "lucide-react";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { createCampaign, listCampaignServices, type CampaignService } from "@/lib/api";
import {
  clearAdminSession,
  getStoredAdminSession,
  storeAdminSession,
  type AdminSession,
} from "@/lib/adminSession";
import { applyTheme, getInitialTheme, type ThemeMode } from "@/lib/theme";

type Notice = {
  tone: "success" | "error";
  text: string;
};

const navItems = [
  { href: "/?view=dashboard", icon: LayoutDashboard, label: "Dashboard", active: false },
  { href: "/?view=campaigns", icon: Gift, label: "Campaigns", active: true },
  { href: "/?view=reports", icon: BarChart3, label: "Reports", active: false },
  { href: "/?view=locations", icon: MapPin, label: "Locations", active: false },
  { href: "/?view=timeline", icon: Clock3, label: "Timeline", active: false },
  { href: "/?view=settings", icon: Settings, label: "Settings", active: false },
];

export default function CreateCampaignPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budgetCap, setBudgetCap] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [services, setServices] = useState<CampaignService[]>([]);
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    const savedSession = getStoredAdminSession();
    if (savedSession) setAdminSession(savedSession);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!adminSession?.token) return;
    void listCampaignServices(adminSession.token)
      .then((res) => {
        const liveServices = res.data.services || [];
        setServices(liveServices);
        setAllowedTools(liveServices.filter((service) => service.live).map((service) => service.id));
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not load campaign services.";
        setNotice({ tone: "error", text: message });
      });
  }, [adminSession?.token]);

  const handleBack = () => {
    router.push("/?view=campaigns");
  };

  const handleAuthenticated = (session: AdminSession) => {
    storeAdminSession(session);
    setAdminSession(session);
    setNotice({ tone: "success", text: "Signed in successfully. You can create a campaign now." });
  };

  const handleLogout = () => {
    clearAdminSession();
    setAdminSession(null);
    setNotice(null);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setNotice({ tone: "error", text: "Campaign name is required." });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      await createCampaign(
        {
          name: name.trim(),
          description: description.trim(),
          allowedTools,
          budgetCap: budgetCap ? Number(budgetCap) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
        adminSession?.token
      );
      router.push("/?view=campaigns");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create campaign.";
      setNotice({ tone: "error", text: message });
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return (
      <DashboardChrome sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((value) => !value)} themeMode={themeMode} onToggleTheme={() => setThemeMode((mode) => (mode === "dark" ? "light" : "dark"))}>
        <div className="grid min-h-[420px] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
        </div>
      </DashboardChrome>
    );
  }

  if (!adminSession) {
    return (
      <DashboardChrome sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((value) => !value)} adminSession={adminSession} onLogout={handleLogout} themeMode={themeMode} onToggleTheme={() => setThemeMode((mode) => (mode === "dark" ? "light" : "dark"))}>
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={handleBack}
            className="mb-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <AdminLoginForm onAuthenticated={handleAuthenticated} />
        </div>
      </DashboardChrome>
    );
  }

  return (
    <DashboardChrome sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((value) => !value)} adminSession={adminSession} onLogout={handleLogout} themeMode={themeMode} onToggleTheme={() => setThemeMode((mode) => (mode === "dark" ? "light" : "dark"))}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            disabled={loading}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#2f8f42]">
              <Plus className="h-4 w-4" />
              Promotional bonus admin
            </div>
            <h2 className="text-base font-semibold text-slate-950">Campaign details</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Set up a bonus credit campaign for CV optimization.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {notice && (
            <div
              className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                notice.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-[#48C05C]/30 bg-[#48C05C]/10 text-[#2f8f42]"
              }`}
            >
              {notice.text}
            </div>
          )}

          <div className="grid gap-4">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Campaign name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-950 outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10"
                placeholder="Campaign name"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-950 outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10"
                placeholder="Description"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Budget cap
                <input
                  value={budgetCap}
                  onChange={(event) => setBudgetCap(event.target.value)}
                  type="number"
                  min="0"
                  className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-950 outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10"
                  placeholder="Optional"
                />
              </label>

              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Expiry date
                <input
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  type="date"
                  className="custom-date min-h-11 text-sm font-normal"
                />
              </label>
            </div>

            <div className="grid gap-2 rounded-lg bg-slate-50 px-3 py-3">
              <p className="text-sm font-medium text-slate-700">Allowed services</p>
              {services.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {services.map((service) => (
                    <label key={service.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={allowedTools.includes(service.id)}
                        onChange={() =>
                          setAllowedTools((current) =>
                            current.includes(service.id)
                              ? current.filter((tool) => tool !== service.id)
                              : [...current, service.id]
                          )
                        }
                        disabled={!service.live || loading}
                        className="mt-0.5 h-4 w-4 accent-[#48C05C]"
                      />
                      <span>
                        <span className="block font-medium text-slate-800">{service.label}</span>
                        {service.description && <span className="block text-xs text-slate-500">{service.description}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No campaign services loaded.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#48C05C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3aa94e] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {loading ? "Creating" : "Create campaign"}
            </button>
          </div>
        </form>
      </div>
    </DashboardChrome>
  );
}

function DashboardChrome({
  children,
  sidebarCollapsed,
  onToggleSidebar,
  adminSession,
  onLogout,
  themeMode,
  onToggleTheme,
}: {
  children: ReactNode;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  adminSession?: AdminSession | null;
  onLogout?: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[#0f3d20] bg-[#14532d] text-white shadow-xl transition-all duration-300 lg:flex lg:flex-col ${sidebarCollapsed ? "w-20" : "w-72"}`}>
        <div className={`border-b border-white/15 py-5 ${sidebarCollapsed ? "px-4" : "px-5"}`}>
          <div className={`flex ${sidebarCollapsed ? "justify-center" : "justify-end"}`}>
            <button
              type="button"
              onClick={onToggleSidebar}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/20 text-white/85 transition hover:bg-white/15"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-5 text-sm">
          {(adminSession ? navItems : []).map((item) => (
            <Link
              key={item.label}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${item.active ? "bg-white text-[#48C05C] shadow-sm" : "text-white/80 hover:bg-white/15 hover:text-white"} ${sidebarCollapsed ? "justify-center" : ""}`}
            >
              <item.icon className="h-4 w-4" />
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          ))}
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
                    onClick={onLogout}
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
          {adminSession ? navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-[11px] font-medium transition ${
                item.active ? "bg-white text-[#2f8f42] shadow-sm" : "text-white/80 hover:bg-white/15 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )) : (
            <div className="flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 text-[11px] font-medium text-[#2f8f42] shadow-sm">
              <LogIn className="h-4 w-4" />
              <span>Login</span>
            </div>
          )}
          {adminSession && (
            <button
              type="button"
              onClick={onLogout}
              className="flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-[11px] font-medium text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <UserCircle className="h-4 w-4" />
              <span className="max-w-20 truncate">{adminSession.displayName}</span>
            </button>
          )}
        </nav>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8 2xl:px-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create Campaign</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Add a campaign without leaving the dashboard workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                aria-label="Toggle theme"
              >
                {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {themeMode === "dark" ? "Light" : "Dark"}
              </button>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8 2xl:px-10">
          {children}
        </div>
      </div>
    </main>
  );
}
