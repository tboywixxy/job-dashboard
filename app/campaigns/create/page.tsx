"use client";
import { BrandLogo } from "@/components/BrandLogo";
import { Skeleton, WorkspaceSkeleton } from "@/components/Skeleton";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
  MessageSquare,
  Scale,
  RefreshCw,
  Sun,
  Users,
  UserCircle,
} from "lucide-react";
import { ToastNotice } from "@/components/ToastNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { createCampaign, listCampaignServices, type CampaignService } from "@/lib/api";
import {
  ADMIN_SESSION_EVENT,
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
  { href: "/?view=users", icon: Users, label: "Users", active: false },
  { href: "/?view=ledger", icon: Scale, label: "Ledger", active: false },
  { href: "/?view=reports", icon: BarChart3, label: "Reports", active: false },
  { href: "/?view=locations", icon: MapPin, label: "Locations", active: false },
  { href: "/?view=timeline", icon: Clock3, label: "Timeline", active: false },
  { href: "/?view=feedback", icon: MessageSquare, label: "Feedback", active: false },
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
  const servicesInitialized = useRef(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

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
    if (!adminSession?.token) return;
    void listCampaignServices(adminSession.token)
      .then((res) => {
        const liveServices = res.data.services || [];
        setServices(liveServices);
        if (!servicesInitialized.current) {
          setAllowedTools(liveServices.filter((service) => service.live).map((service) => service.id));
          servicesInitialized.current = true;
        }
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

  const confirmLogout = () => {
    setLogoutDialogOpen(false);
    clearAdminSession();
    setAdminSession(null);
    setNotice(null);
  };

  const handleLogout = () => setLogoutDialogOpen(true);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setNotice({ tone: "error", text: "Campaign name is required." });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const expiry = expiresAt ? new Date(`${expiresAt}T23:59:59.999`).toISOString() : null;
      const input = { name: name.trim(), description: description.trim(), allowedTools,
        budgetCap: budgetCap ? Number(budgetCap) : null, expiresAt: expiry };
      if (input.budgetCap !== null && (!Number.isFinite(input.budgetCap) || input.budgetCap < 0)) throw new Error("Enter a valid budget cap.");
      if (expiresAt && new Date(expiry!).getTime() <= Date.now()) throw new Error("Expiration must be in the future.");
      await createCampaign(input, adminSession?.token);
      setNotice({ tone: "success", text: "Campaign created. Choose users visually from the campaign workspace to fund members." });
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
      <ConfirmDialog open={logoutDialogOpen} title="Sign out of the admin workspace?" description="Your current session will be cleared from this browser. You can sign back in at any time." confirmLabel="Sign out" onClose={() => setLogoutDialogOpen(false)} onConfirm={confirmLogout} />
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
  adminSession: AdminSession;
  onLogout?: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}) {
  return (
    <main className="admin-workspace min-h-screen">
      <aside className={`admin-sidebar fixed inset-y-0 left-0 z-30 hidden transition-all duration-300 lg:flex lg:flex-col ${sidebarCollapsed ? "w-20 is-collapsed" : "w-64"}`}>
        <div className={`border-b border-white/15 py-5 ${sidebarCollapsed ? "px-4" : "px-5"}`}>
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? "flex-col justify-center" : "justify-between"}`}>
            <BrandLogo compact={sidebarCollapsed} />
            <button
              type="button"
              onClick={onToggleSidebar}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/20 text-white/85 transition hover:bg-white/15"
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
              className={`admin-nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${item.active ? "is-active" : ""} ${sidebarCollapsed ? "justify-center" : ""}`}
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
        <MobileNavigation title="Create Campaign" onRefresh={() => window.location.reload()} items={navItems} onLogout={onLogout} themeMode={themeMode} onToggleTheme={onToggleTheme} />
        <header className="admin-header">
          <div className="admin-topbar">
            <div className="admin-topbar-inner mx-auto max-w-[1600px] px-4 sm:px-6 xl:px-8 2xl:px-10">
              <span className="admin-topbar-title">Create Campaign</span>
              <div className="ml-auto flex items-center gap-3"><button type="button" onClick={() => window.location.reload()} className="ui-button desktop-refresh-button" aria-label="Refresh page" title="Refresh page"><RefreshCw className="h-4 w-4" /></button><button type="button" onClick={onToggleTheme} className="ui-button desktop-theme-toggle" aria-label="Toggle theme">{themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><span className="admin-avatar" aria-hidden="true">{adminSession.displayName.slice(0, 2).toUpperCase()}</span><div className="hidden text-left sm:block"><p className="text-xs font-semibold text-slate-800">{adminSession.displayName}</p><p className="text-[11px] text-slate-500">Administrator</p></div></div>
            </div>
          </div>
          <div className="admin-header-spacer" aria-hidden="true" />
        </header>
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8 2xl:px-10">
          {children}
        </div>
      </div>
    </main>
  );
}
