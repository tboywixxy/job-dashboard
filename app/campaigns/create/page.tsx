"use client";
import { Skeleton, WorkspaceSkeleton } from "@/components/Skeleton";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { MobileNavigation } from "@/components/MobileNavigation";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gift,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  Plus,
  Sun,
  UserCircle,
} from "lucide-react";
import { ToastNotice } from "@/components/ToastNotice";
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
    if (!window.confirm("Are you sure you want to log out?")) return;
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

  if (!authReady) return <WorkspaceSkeleton />;
  if (!adminSession) return <main className="login-screen"><AdminLoginForm onAuthenticated={handleAuthenticated} /></main>;

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
          {notice && <ToastNotice tone={notice.tone} text={notice.text} onClose={() => setNotice(null)} />}

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
              {!loading && <Plus className="h-4 w-4" />}
              {loading ? <Skeleton label="Creating campaign" className="h-4 w-28" /> : "Create campaign"}
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
    <main className="admin-workspace min-h-screen bg-[#f5f7fb] text-slate-950">
      <aside className={`admin-sidebar fixed inset-y-0 left-0 z-30 hidden border-r border-[#0f3d20] bg-[#14532d] text-white shadow-xl transition-all duration-300 lg:flex lg:flex-col ${sidebarCollapsed ? "w-20" : "w-64"}`}>
        <div className={`border-b border-white/15 py-5 ${sidebarCollapsed ? "px-4" : "px-5"}`}>
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
            {!sidebarCollapsed && <Link href="/" className="brand-lockup"><span className="brand-mark">M</span><span>Mastaskillz<small>ADMIN WORKSPACE</small></span></Link>}
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
              aria-current={item.active ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${item.active ? "bg-white text-[#48C05C] shadow-sm" : "text-white/80 hover:bg-white/15 hover:text-white"} ${sidebarCollapsed ? "justify-center" : ""}`}
            >
              <item.icon className="h-4 w-4" />
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div className={`sidebar-account border-t p-3 ${sidebarCollapsed ? "is-collapsed" : ""}`}>
          {!sidebarCollapsed && <div className="mb-3 flex items-center gap-3 px-2"><UserCircle size={25} /><span className="truncate text-sm">{adminSession?.displayName}</span></div>}
          <button type="button" onClick={onLogout} className="ui-button logout-button"><LogOut size={16} /><span>Logout</span></button>
        </div>
      </aside>

      <div className={`min-w-0 transition-all duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <MobileNavigation items={navItems} onLogout={onLogout} themeMode={themeMode} onToggleTheme={onToggleTheme} />
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
                className="desktop-theme-toggle inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
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
