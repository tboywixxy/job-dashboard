"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { CustomSelect } from "@/components/CustomSelect";
import { ToastNotice } from "@/components/ToastNotice";
import { listAdminUsers, reconcileLedger, type AdminUser, type LedgerReconciliationResult, type Pagination } from "@/lib/api";

const emptyPage: Pagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
const idOf = (user: AdminUser) => user.userId || user.id || "";
const nameOf = (user: AdminUser) => user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unnamed user";
const money = (value: number, currency: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export function LedgerReconciliationPanel({ token }: { token: string }) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState(emptyPage);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [ownerType, setOwnerType] = useState("user");
  const [kind, setKind] = useState("wallet");
  const [currency, setCurrency] = useState("NGN");
  const [result, setResult] = useState<LedgerReconciliationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await listAdminUsers({ token, name: search.trim(), page, limit: 10 });
      setUsers(response.data.users || []); setPagination(response.data.pagination || emptyPage);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load users."); }
    finally { setLoading(false); }
  }, [search, token]);
  useEffect(() => { void loadUsers(1); }, [loadUsers]);

  const reconcile = async () => {
    if (ownerType === "user" && !selected) { setNotice("Select a user before reconciling a user ledger."); return; }
    setLoading(true); setResult(null);
    try {
      const response = await reconcileLedger({ userId: selected ? idOf(selected) : undefined, ownerType, kind, currency }, token);
      setResult(response.data);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Reconciliation failed."); }
    finally { setLoading(false); }
  };

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,.7fr)]">
    {notice && <ToastNotice tone="error" text={notice} onClose={() => setNotice(null)} />}
    <section className="surface overflow-hidden">
      <div className="border-b p-5"><h2 className="font-semibold">Choose ledger owner</h2><p className="mt-1 text-sm text-slate-500">Search by name or email; the account ID stays internal.</p>
        <div className="mt-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className="min-h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void loadUsers(1)} placeholder="Search users"/></div><button className="ui-button" onClick={() => void loadUsers(1)}>Search</button></div>
      </div>
      <div className="divide-y">{users.length ? users.map((user) => <button key={idOf(user)} onClick={() => { setSelected(user); setResult(null); }} className={`flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 ${idOf(selected || {}) === idOf(user) ? "bg-emerald-50" : ""}`}><span><span className="block font-medium">{nameOf(user)}</span><span className="text-xs text-slate-500">{user.email}</span></span>{idOf(selected || {}) === idOf(user) && <CheckCircle2 className="h-5 w-5 text-emerald-600"/>}</button>) : <p className="p-10 text-center text-sm text-slate-500">{loading ? "Loading users…" : "No matching users."}</p>}</div>
      <div className="flex justify-between border-t p-4"><span className="text-sm text-slate-500">{pagination.total} results</span><div className="flex gap-2"><button className="ui-button" disabled={pagination.page <= 1 || loading} onClick={() => void loadUsers(pagination.page - 1)}>Previous</button><button className="ui-button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void loadUsers(pagination.page + 1)}>Next</button></div></div>
    </section>
    <div className="space-y-6"><section className="surface p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600"/><h2 className="font-semibold">Reconcile ledger</h2></div><p className="mt-1 text-sm text-slate-500">The ledger is authoritative. This verifies its hash chain and repairs the cached balance when required.</p>
      <div className="mt-5 grid gap-4"><label className="grid gap-1 text-sm font-medium">Owner type<CustomSelect value={ownerType} options={[{value:"user",label:"User"}]} onChange={setOwnerType} ariaLabel="Owner type"/></label><label className="grid gap-1 text-sm font-medium">Account kind<CustomSelect value={kind} options={[{value:"wallet",label:"Wallet"}]} onChange={setKind} ariaLabel="Ledger kind"/></label><label className="grid gap-1 text-sm font-medium">Currency<CustomSelect value={currency} options={[{value:"NGN",label:"NGN"}]} onChange={setCurrency} ariaLabel="Currency"/></label>
      <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="text-slate-500">Selected owner</span><p className="mt-1 font-medium">{selected ? `${nameOf(selected)} · ${selected.email || "No email"}` : "No user selected"}</p></div><button className="ui-button ui-primary" disabled={loading || (ownerType === "user" && !selected)} onClick={() => void reconcile()}>{loading ? "Reconciling…" : "Run reconciliation"}</button></div>
    </section>
    {result && <section className={`surface border-2 p-5 ${result.chainIntact ? "border-emerald-200" : "border-rose-300"}`}><div className="flex items-center gap-2">{result.chainIntact ? <CheckCircle2 className="text-emerald-600"/> : <AlertTriangle className="text-rose-600"/>}<h2 className="font-semibold">{result.chainIntact ? "Ledger chain intact" : "Ledger integrity issue"}</h2></div><dl className="mt-4 grid grid-cols-2 gap-3">{[["Ledger balance",money(result.ledgerBalance,currency)],["Cached balance",money(result.cachedBalance,currency)],["Drift",money(result.drift,currency)],["Repaired",result.repaired ? "Yes" : "No"]].map(([k,v]) => <div key={k} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>)}</dl>{!result.chainIntact && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">Broken at entry: {result.chainBrokenAtEntry || "The API did not identify an entry."}</p>}</section>}
    </div>
  </div>;
}
