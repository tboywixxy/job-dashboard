"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Shield, Trash2, UserRound } from "lucide-react";
import { CustomSelect } from "@/components/CustomSelect";
import { FilterBar } from "@/components/FilterBar";
import { SidePanel } from "@/components/SidePanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ToastNotice } from "@/components/ToastNotice";
import {
  deleteAdminUser,
  getAdminUser,
  listAdminUsers,
  updateAdminUserRole,
  type AdminUser,
  type Pagination,
} from "@/lib/api";

const emptyPage: Pagination = { page: 1, limit: 20, total: 0, totalPages: 1 };
const roleOptions = [
  { value: "all", label: "All roles" },
  { value: "user", label: "User" },
  { value: "employer", label: "Employer" },
  { value: "admin", label: "Admin" },
] as const;

function userId(user: AdminUser) { return user.userId || user.id || ""; }
function userName(user: AdminUser) {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unnamed user";
}
function money(value?: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value || 0);
}
function date(value?: string) { return value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
function message(error: unknown) { return error instanceof Error ? error.message : "The request could not be completed."; }

export function AdminUsersPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState(emptyPage);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "user" | "employer" | "admin">("all");
  const [hasBonus, setHasBonus] = useState<"all" | "true" | "false">("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [details, setDetails] = useState<AdminUser | null>(null);
  const [nextRole, setNextRole] = useState<"user" | "employer" | "admin">("user");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState<"role" | "delete" | null>(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await listAdminUsers({
        token, name: search.trim(), role, hasBonus: hasBonus === "all" ? "all" : hasBonus === "true",
        createdFrom: createdFrom ? new Date(`${createdFrom}T00:00:00`).toISOString() : undefined,
        createdTo: createdTo ? new Date(`${createdTo}T23:59:59.999`).toISOString() : undefined,
        page, limit: 20,
      });
      setUsers(result.data.users || []);
      setPagination(result.data.pagination || emptyPage);
    } catch (error) { setNotice({ tone: "error", text: message(error) }); }
    finally { setLoading(false); }
  }, [createdFrom, createdTo, hasBonus, role, search, token]);

  useEffect(() => { void load(1); }, [load]);

  const openUser = async (user: AdminUser) => {
    const id = userId(user);
    if (!id) return;
    setSelected(user); setDetails(user); setNextRole((user.role as typeof nextRole) || "user"); setLoading(true);
    try {
      const response = await getAdminUser(id, token);
      const data = response.data;
      const loaded = ("user" in data ? data.user : data) as AdminUser;
      setDetails(loaded); setNextRole((loaded.role as typeof nextRole) || "user");
    } catch (error) { setNotice({ tone: "error", text: message(error) }); }
    finally { setLoading(false); }
  };

  const applyRoleChange = async () => {
    if (!details) return;
    const id = userId(details);
    setLoading(true);
    try {
      await updateAdminUserRole(id, nextRole, token);
      setDetails({ ...details, role: nextRole, isAdmin: nextRole === "admin" });
      setUsers((rows) => rows.map((row) => userId(row) === id ? { ...row, role: nextRole, isAdmin: nextRole === "admin" } : row));
      setNotice({ tone: "success", text: `Role updated to ${nextRole}.` });
      await load(pagination.page);
    } catch (error) { setNotice({ tone: "error", text: message(error) }); }
    finally { setLoading(false); }
  };

  const changeRole = async () => {
    if (!details) return;
    const oldRole = details.role || "user";
    if (oldRole === "admin" || nextRole === "admin") {
      setConfirmation("role");
      return;
    }
    await applyRoleChange();
  };

  const removeUser = async () => {
    if (!details) return;
    setLoading(true);
    try {
      await deleteAdminUser(userId(details), token);
      setSelected(null); setDetails(null);
      setNotice({ tone: "success", text: "User deleted." });
      await load(1);
    } catch (error) { setNotice({ tone: "error", text: message(error) }); }
    finally { setLoading(false); }
  };

  const requestDelete = () => setConfirmation("delete");

  return <div className="space-y-5">
    {notice && <ToastNotice tone={notice.tone} text={notice.text} onClose={() => setNotice(null)} />}
    <FilterBar label="" summary={[search, role !== "all" ? role : "", hasBonus !== "all" ? (hasBonus === "true" ? "Has bonus" : "No bonus") : "", createdFrom, createdTo].filter(Boolean).join(" / ") || "All users"}>
      <div className="filter-toolbar-layout">
        <div className="filter-toolbar-scroll">
          <div className="filter-toolbar-fields admin-users-filter-fields flex flex-col gap-4 xl:flex-row xl:items-end">
            <label className="grid flex-1 gap-1 text-xs font-medium text-slate-500">Name or email
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void load(1)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm" placeholder="Search users"/></div>
            </label>
            <CustomSelect value={role} options={[...roleOptions]} onChange={setRole} ariaLabel="Role filter" className="xl:w-44"/>
            <CustomSelect value={hasBonus} options={[{value:"all",label:"Any bonus"},{value:"true",label:"Has bonus"},{value:"false",label:"No bonus"}]} onChange={setHasBonus} ariaLabel="Bonus filter" className="xl:w-44"/>
            <input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} className="custom-date min-h-10 text-sm" aria-label="Created from"/>
            <input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} className="custom-date min-h-10 text-sm" aria-label="Created to"/>
          </div>
        </div>
        <div className="filter-actions"><button onClick={() => void load(1)} disabled={loading} className="ui-button ui-primary">Apply filters</button></div>
      </div>
    </FilterBar>
    <section className="surface overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-slate-50"><tr>{["#","User","Role","Bonus balance","Bonuses","Created",""].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{users.length ? users.map((user, index) => <tr key={userId(user)} className="hover:bg-slate-50"><td className="px-4 py-3 text-slate-400 tabular-nums">{index + 1}</td><td className="px-4 py-3"><p className="font-medium">{userName(user)}</p><p className="text-xs text-slate-500">{user.email || "—"}</p></td><td className="px-4 py-3 capitalize">{user.role || (user.isAdmin ? "admin" : "user")}</td><td className="px-4 py-3">{money(user.bonusBalance)}</td><td className="px-4 py-3">{user.bonusCount ?? 0}</td><td className="px-4 py-3">{date(user.createdAt)}</td><td className="px-4 py-3 text-right"><button className="ui-button" onClick={() => void openUser(user)}>View</button></td></tr>) : <tr><td colSpan={7} className="p-10 text-center text-slate-500">{loading ? "Loading users…" : "No users match these filters."}</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between border-t p-4 text-sm text-slate-500"><span>{pagination.total.toLocaleString()} users</span><div className="flex gap-2"><button className="ui-button" disabled={loading || pagination.page <= 1} onClick={() => void load(pagination.page - 1)}>Previous</button><button className="ui-button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => void load(pagination.page + 1)}>Next</button></div></div>
    </section>
    <SidePanel open={Boolean(selected)} title={details ? userName(details) : "User details"} description={details?.email || "Account details"} onClose={() => { setSelected(null); setDetails(null); }} busy={loading} footer={<><button className="ui-button" onClick={() => setSelected(null)}>Close</button><button className="ui-button ui-primary" disabled={loading} onClick={() => void changeRole()}><Shield size={16}/>Update role</button></>}>
      {details && <div className="space-y-5"><dl className="grid grid-cols-2 gap-3">{[["Email",details.email],["Created",date(details.createdAt)],["Bonus balance",money(details.bonusBalance)],["Bonus count",String(details.bonusCount ?? 0)]].map(([k,v]) => <div key={k} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-1 break-words text-sm font-medium">{v || "—"}</dd></div>)}</dl>
      <label className="grid gap-1 text-sm font-medium">Account role<CustomSelect value={nextRole} options={roleOptions.filter((o) => o.value !== "all") as {value: typeof nextRole; label: string}[]} onChange={setNextRole} ariaLabel="Account role"/></label>
      <div className="rounded-lg border border-slate-200 p-4"><div className="flex items-center gap-2 font-medium"><UserRound size={16}/>Active sessions</div>{Array.isArray(details.activeSessions) ? <div className="mt-3 space-y-2">{details.activeSessions.length ? details.activeSessions.map((session,index) => <div key={session.id || index} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">{session.device || "Session"}</p><p className="mt-1 text-xs text-slate-500">{session.ipAddress || "IP not returned"} · Last active {date(session.lastActiveAt || session.createdAt)}</p></div>) : <p className="text-sm text-slate-500">No active sessions.</p>}</div> : <p className="mt-2 text-sm text-slate-500">{details.activeSessions ?? "No session information returned."}</p>}</div>
      <button className="ui-button w-full border-rose-200 text-rose-700" disabled={loading} onClick={requestDelete}><Trash2 size={16}/>Delete this user</button></div>}
    </SidePanel>
    <ConfirmDialog
      open={confirmation !== null}
      title={confirmation === "role" ? "Confirm administrative access change" : "Delete this user?"}
      description={confirmation === "role" ? `You are changing ${details ? userName(details) : "this account"} to ${nextRole}. Admin access changes affect what this person can manage.` : `This will remove ${details ? userName(details) : "this account"} from the admin directory and may affect account access. This action cannot be undone.`}
      confirmLabel={confirmation === "role" ? "Update role" : "Delete user"}
      tone={confirmation === "delete" ? "danger" : "default"}
      busy={loading}
      onClose={() => setConfirmation(null)}
      onConfirm={() => { setConfirmation(null); void (confirmation === "role" ? applyRoleChange() : removeUser()); }}
    />
  </div>;
}
