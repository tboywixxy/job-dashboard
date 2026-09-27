"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { ToastNotice } from "@/components/ToastNotice";
import { getAdminStats, type AdminStats } from "@/lib/api";

function label(key: string) { return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase()); }
function display(value: unknown) {
  if (typeof value === "number") return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  return "—";
}

export function AdminStatsPanel({ token }: { token: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await getAdminStats(token);
      const root = response as unknown as Record<string, unknown>;
      setStats((root.data && typeof root.data === "object" ? root.data : root) as AdminStats);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load admin statistics."); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  const metrics = useMemo(() => Object.entries(stats || {}).filter(([, value]) => ["string","number","boolean"].includes(typeof value)), [stats]);
  const groups = useMemo(() => Object.entries(stats || {}).filter(([, value]) => value && typeof value === "object" && !Array.isArray(value)), [stats]);
  if (loading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((n) => <Skeleton key={n} className="h-32"/>)}</div>;
  return <div className="space-y-6">{error && <ToastNotice tone="error" text={error} onClose={() => setError(null)}/>} 
    {!metrics.length && !groups.length ? <section className="surface p-10 text-center text-sm text-slate-500">The admin stats endpoint returned no displayable metrics.</section> : null}
    {metrics.length > 0 && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([key,value]) => <div key={key} className="surface p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label(key)}</p><p className="mt-2 truncate text-2xl font-semibold" title={String(value)}>{display(value)}</p></div>)}</section>}
    {groups.map(([group,value]) => { const entries = Object.entries(value as Record<string,unknown>).filter(([,v]) => ["string","number","boolean"].includes(typeof v)); return entries.length ? <section key={group} className="surface p-5"><h2 className="font-semibold">{label(group)}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{entries.map(([key,item]) => <div key={key} className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{label(key)}</p><p className="mt-1 text-xl font-semibold">{display(item)}</p></div>)}</div></section> : null; })}
  </div>;
}
