"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  Wallet,
} from "lucide-react";
import {
  bulkFundCampaignMembers,
  getCampaignReport,
  getUserBalance,
  listCampaigns,
  revokeCampaignMembers,
  setBillingConsent,
  updateCampaign,
  type Campaign,
  type CampaignReport,
  type CampaignStatus,
  type UserBalance,
} from "@/lib/api";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

const statusOptions: (CampaignStatus | "all")[] = ["all", "active", "paused", "ended"];

function currency(value: number | null | undefined) {
  if (value == null) return "Uncapped";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateText(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function userFacingError(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  const status = typeof err === "object" && err && "status" in err ? (err as { status?: unknown }).status : undefined;
  if (status === 402 || /\b402\b|wallet shortfall|paid balance/i.test(message)) {
    return "Paid wallet approval is needed before this charge can continue.";
  }
  if (/billing-consent|autoBillWalletWhenBonusLow/i.test(message)) {
    return "We could not update the paid wallet preference. Please try again.";
  }
  if (/Request failed/i.test(message)) {
    return "We could not complete that request. Please try again.";
  }
  return message || "We could not complete that request. Please try again.";
}

function parseMembers(input: string, amount?: number) {
  return input
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(":").map((part) => part.trim());
      const identifier = parts[0];
      const rowAmount = parts[1] ? Number(parts[1]) : amount;
      const member = identifier.includes("@")
        ? { email: identifier, amount: rowAmount }
        : { userId: identifier, amount: rowAmount };
      return member;
    });
}

export function CampaignsPanel({ token }: { token: string }) {
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [fundAmount, setFundAmount] = useState("500");
  const [fundMembers, setFundMembers] = useState("");
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [revokeUsers, setRevokeUsers] = useState("");

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );
  const bonusBalance = balance?.bonus?.balance ?? 0;
  const bonusItems = balance?.bonus?.items ?? [];

  const totalStats = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => {
        acc.memberCount += campaign.stats?.memberCount || 0;
        acc.totalGranted += campaign.stats?.totalGranted || 0;
        acc.totalRemaining += campaign.stats?.totalRemaining || 0;
        acc.totalSpent += campaign.stats?.totalSpent || 0;
        return acc;
      },
      { memberCount: 0, totalGranted: 0, totalRemaining: 0, totalSpent: 0 }
    );
  }, [campaigns]);

  const showError = useCallback((err: unknown) => {
    setNotice({ tone: "error", text: userFacingError(err) });
  }, []);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await listCampaigns({ token, status: statusFilter });
      const items = res.data.campaigns || [];
      setCampaigns(items);
      setSelectedCampaignId((currentId) => {
        if (currentId && items.some((campaign) => campaign.id === currentId)) return currentId;
        return items[0]?.id || "";
      });
      setNotice({ tone: "success", text: "Campaigns refreshed." });
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [showError, statusFilter, token]);

  useEffect(() => {
    if (token) void loadCampaigns();
  }, [loadCampaigns, token]);

  const loadReport = async (id = selectedCampaignId) => {
    if (!id) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await getCampaignReport(id, token);
      setReport(res.data);
      setNotice({ tone: "success", text: "Campaign report loaded." });
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await getUserBalance(token);
      setBalance(res.data);
      setNotice({ tone: "success", text: "Balance refreshed." });
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: CampaignStatus) => {
    if (!selectedCampaignId) return;
    setLoading(true);
    setNotice(null);
    try {
      await updateCampaign(selectedCampaignId, { status }, token);
      setNotice({ tone: "success", text: `Campaign marked ${status}.` });
      await loadCampaigns();
      await loadReport(selectedCampaignId);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async () => {
    if (!selectedCampaignId) return;
    const sharedAmount = Number(fundAmount);
    const members = parseMembers(fundMembers, sharedAmount);

    if (members.length === 0) {
      setNotice({ tone: "error", text: "Add at least one email or user ID to fund." });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const res = await bulkFundCampaignMembers(
        selectedCampaignId,
        { members, amount: sharedAmount, notify: notifyMembers },
        token
      );
      const funded = res.data.funded?.length || 0;
      const unmatched = res.data.unmatched?.length || 0;
      setFundMembers("");
      setNotice({
        tone: unmatched ? "info" : "success",
        text: `Funded ${funded} member(s). ${unmatched} unmatched.`,
      });
      await loadCampaigns();
      await loadReport(selectedCampaignId);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedCampaignId) return;
    const userIds = revokeUsers
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (userIds.length === 0) {
      setNotice({ tone: "error", text: "Add at least one user ID to revoke." });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const res = await revokeCampaignMembers(selectedCampaignId, userIds, token);
      setRevokeUsers("");
      setNotice({
        tone: "success",
        text: `Revoked ${res.data.revoked?.length || 0}; ${res.data.notFound?.length || 0} not found.`,
      });
      await loadCampaigns();
      await loadReport(selectedCampaignId);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConsent = async (value: boolean) => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await setBillingConsent(value, token);
      setBalance((current) =>
        current
          ? {
              ...current,
              autoBillWalletWhenBonusLow:
                res.data.autoBillWalletWhenBonusLow ?? value,
            }
          : current
      );
      await loadBalance();
      setNotice({
        tone: "success",
        text: value
          ? "Paid wallet backup is now on."
          : "Paid wallet backup now asks before each charge.",
      });
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#2f8f42]">
              <ShieldCheck className="h-4 w-4" />
              Promotional bonus admin
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Filter and refresh campaign data, or securely end this admin session.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[520px]">
            <Link
              href="/campaigns/create"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#48C05C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3aa94e] sm:w-fit xl:self-end"
            >
              Create campaign
            </Link>
            <div className="grid w-full grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(180px,1fr)_auto_auto]">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CampaignStatus | "all")}
                aria-label="Filter campaigns by status"
                className="col-span-2 min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10 sm:col-span-1"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All statuses" : status}
                  </option>
                ))}
              </select>
              <button
                onClick={loadCampaigns}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <button
                onClick={() => {
                  setCampaigns([]);
                  setSelectedCampaignId("");
                  setReport(null);
                  setBalance(null);
                  setNotice({ tone: "info", text: "Use the sidebar account control to end this admin session." });
                }}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {notice && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              notice.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : notice.tone === "success"
                  ? "border-[#48C05C]/30 bg-[#48C05C]/10 text-[#2f8f42]"
                  : "border-[#48C05C]/30 bg-[#48C05C]/10 text-[#2f8f42]"
            }`}
          >
            {notice.text}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          ["Campaigns", campaigns.length.toLocaleString()],
          ["Members", totalStats.memberCount.toLocaleString()],
          ["Granted", currency(totalStats.totalGranted)],
          ["Remaining", currency(totalStats.totalRemaining)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 truncate text-xl font-semibold text-slate-950 sm:text-2xl" title={value}>{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 2xl:gap-8">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Campaign List</h3>
              <p className="text-sm text-slate-500">Newest first from the admin campaign endpoint.</p>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {campaigns.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No campaigns loaded yet.</p>
            ) : (
              campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => setSelectedCampaignId(campaign.id)}
                  aria-pressed={selectedCampaignId === campaign.id}
                  className={`rounded-xl border p-4 text-left transition ${selectedCampaignId === campaign.id ? "border-[#48C05C] bg-[#48C05C]/10" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{campaign.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{campaign.code}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${campaign.status === "active" ? "bg-[#48C05C]/10 text-[#2f8f42]" : campaign.status === "paused" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      {campaign.status}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div><dt className="text-xs text-slate-500">Granted</dt><dd className="mt-1 font-medium text-slate-800">{currency(campaign.stats?.totalGranted || 0)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Remaining</dt><dd className="mt-1 font-medium text-slate-800">{currency(campaign.stats?.totalRemaining || 0)}</dd></div>
                    <div className="col-span-2"><dt className="text-xs text-slate-500">Budget</dt><dd className="mt-1 font-medium text-slate-800">{currency(campaign.budgetCap)}</dd></div>
                  </dl>
                </button>
              ))
            )}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
            <div className="max-h-96 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Granted</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        No campaigns loaded yet.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((campaign) => (
                      <tr
                        key={campaign.id}
                        onClick={() => setSelectedCampaignId(campaign.id)}
                        className={`cursor-pointer transition hover:bg-slate-50 ${
                          selectedCampaignId === campaign.id ? "bg-[#48C05C]/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-950">{campaign.name}</p>
                          <p className="text-xs text-slate-400">{campaign.code}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              campaign.status === "active"
                                ? "bg-[#48C05C]/10 text-[#2f8f42]"
                                : campaign.status === "paused"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {currency(campaign.stats?.totalGranted || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {currency(campaign.stats?.totalRemaining || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {currency(campaign.budgetCap)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] 2xl:gap-8">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-950">
                Campaign Detail
              </h3>
              <p className="text-sm text-slate-500">
                Load the report to see member grant, spend, remaining, and revoke status.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                onClick={() => loadReport()}
                disabled={!selectedCampaignId || loading}
                className="col-span-2 min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:col-span-1"
              >
                Load report
              </button>
              {(["active", "paused", "ended"] as CampaignStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={!selectedCampaignId || loading}
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium capitalize text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {selectedCampaign ? (
            <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Selected</p>
                <p className="truncate text-sm font-semibold text-slate-950">{selectedCampaign.name}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Members</p>
                <p className="text-sm font-semibold text-slate-950">{selectedCampaign.stats?.memberCount || 0}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Expires</p>
                <p className="text-sm font-semibold text-slate-950">{dateText(selectedCampaign.expiresAt)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Budget left</p>
                <p className="text-sm font-semibold text-slate-950">
                  {selectedCampaign.budgetCap == null
                    ? "Uncapped"
                    : currency(selectedCampaign.budgetCap - (selectedCampaign.stats?.totalGranted || 0))}
                </p>
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="max-h-80 overflow-auto">
              <table className="min-w-[680px] text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Granted</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Spent</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!report?.members.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        No report loaded.
                      </td>
                    </tr>
                  ) : (
                    report.members.map((member) => (
                      <tr key={member.userId}>
                        <td className="px-4 py-3 font-medium text-slate-950">{member.userId}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{currency(member.granted)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{currency(member.spent)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{currency(member.remaining)}</td>
                        <td className="px-4 py-3 text-slate-600">{member.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-1">
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-[#2f8f42]" />
              <h3 className="text-base font-semibold text-slate-950">Fund Members</h3>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <input
                value={fundAmount}
                onChange={(event) => setFundAmount(event.target.value)}
                type="number"
                min="1"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10"
                placeholder="Shared amount"
              />
              <textarea
                value={fundMembers}
                onChange={(event) => setFundMembers(event.target.value)}
                rows={5}
                placeholder="Paste emails or user IDs. Use email:amount for row overrides."
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={notifyMembers}
                  onChange={(event) => setNotifyMembers(event.target.checked)}
                  className="h-4 w-4 accent-[#48C05C]"
                />
                Notify funded users
              </label>
              <button
                onClick={handleFund}
                disabled={!selectedCampaignId || loading}
                className="mt-auto min-h-11 w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Fund selected campaign
              </button>
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-rose-600" />
              <h3 className="text-base font-semibold text-slate-950">Revoke Bonus</h3>
            </div>
            <textarea
              value={revokeUsers}
              onChange={(event) => setRevokeUsers(event.target.value)}
              rows={4}
              placeholder="Paste user IDs to revoke unused bonus"
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10"
            />
            <button
              onClick={handleRevoke}
              disabled={!selectedCampaignId || loading}
              className="mt-auto min-h-11 w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              Revoke unused credit
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] 2xl:gap-8">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#2f8f42]" />
            <h3 className="text-base font-semibold text-slate-950">User Wallet & Bonus View</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid balance</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {balance ? currency(balance.balance) : "-"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bonus credit</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {balance ? currency(bonusBalance) : "-"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Spend source</p>
              <p className="mt-2 text-2xl font-semibold capitalize text-slate-950">
                {balance?.activeSource || "-"}
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[620px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Bonus</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tools</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!bonusItems.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                      No live bonus items loaded.
                    </td>
                  </tr>
                ) : (
                  bonusItems.map((item) => (
                    <tr key={item.bonusId}>
                      <td className="px-4 py-3 text-slate-950">{item.bonusId}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{currency(item.remaining)}</td>
                      <td className="px-4 py-3 text-slate-600">{dateText(item.expiresAt)}</td>
                      <td className="px-4 py-3 text-slate-600">{item.allowedTools?.join(", ") || "All tools"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <BadgeDollarSign className="h-4 w-4 text-[#2f8f42]" />
            <h3 className="text-base font-semibold text-slate-950">Paid Wallet Backup</h3>
          </div>
          <p className="text-sm leading-6 text-slate-500">
            Choose what should happen when a user's bonus credit is not enough to finish a CV improvement.
          </p>
          <button
            onClick={loadBalance}
            disabled={loading}
            className="mt-5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Check wallet balance
          </button>
          <div className="mt-3 grid gap-2">
            <button
              onClick={() => handleConsent(true)}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#48C05C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3aa94e] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Use paid wallet backup
            </button>
            <button
              onClick={() => handleConsent(false)}
              disabled={loading}
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Ask before using paid wallet
            </button>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            Customer prompt: &ldquo;Your bonus credit does not cover the full amount. Use your paid wallet for the rest?&rdquo;
          </div>
        </div>
      </section>
    </div>
  );
}

export default CampaignsPanel;
