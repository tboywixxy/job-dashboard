"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  LogOut,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  UserMinus,
  Wallet,
} from "lucide-react";
import { ToastNotice } from "@/components/ToastNotice";
import {
  bulkFundCampaignMembers,
  deleteCampaign,
  getUserBalance,
  listAdminTransactions,
  listCampaignMembers,
  listCampaigns,
  revokeCampaignMembers,
  setBillingConsent,
  updateCampaign,
  type Campaign,
  type CampaignEffectiveStatus,
  type CampaignMember,
  type CampaignStatus,
  type Pagination,
  type UserBalance,
  type WalletTransaction,
} from "@/lib/api";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

const statusOptions: (CampaignEffectiveStatus | "all")[] = ["all", "active", "paused", "expired", "ended"];
const memberStatusOptions: (CampaignMember["status"] | "all")[] = ["all", "active", "exhausted", "expired", "revoked"];
const emptyPagination: Pagination = { total: 0, page: 1, limit: 20, totalPages: 1 };

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

function isoDateBoundary(value: string, boundary: "start" | "end") {
  if (!value) return "";
  return boundary === "start"
    ? new Date(`${value}T00:00:00.000`).toISOString()
    : new Date(`${value}T23:59:59.999`).toISOString();
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
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

function isRouteNotFound(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  const body =
    typeof err === "object" && err && "body" in err
      ? (err as { body?: { message?: string } }).body
      : undefined;
  return /route not found/i.test(message) || /route not found/i.test(body?.message || "");
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
      return identifier.includes("@")
        ? { email: identifier, amount: rowAmount }
        : { userId: identifier, amount: rowAmount };
    });
}

function effectiveStatus(campaign: Campaign) {
  return campaign.effectiveStatus || campaign.status;
}

function statusClass(status: string) {
  if (status === "active" || status === "completed") return "bg-[#48C05C]/10 text-[#2f8f42]";
  if (status === "paused") return "bg-amber-50 text-amber-700";
  if (status === "expired" || status === "failed") return "bg-orange-50 text-orange-700";
  if (status === "ended" || status === "revoked") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function joinName(firstName?: string, lastName?: string) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function displayUser(row: {
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  user?: { name?: string; email?: string; id?: string; userId?: string; firstName?: string; lastName?: string };
}) {
  const rowName = joinName(row.firstName, row.lastName);
  const nestedName = row.user?.name || joinName(row.user?.firstName, row.user?.lastName);
  const email = row.email || row.user?.email || "";
  const id = row.userId || row.user?.userId || row.user?.id || "";
  return {
    primary: rowName || nestedName || email || id || "Unknown user",
    secondary: email && email !== rowName && email !== nestedName ? email : id,
  };
}

function PageControls({
  pagination,
  onPageChange,
  disabled,
}: {
  pagination: Pagination;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const page = pagination.page || 1;
  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const start = pagination.total ? (page - 1) * pagination.limit + 1 : 0;
  const end = Math.min(page * pagination.limit, pagination.total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {pagination.total ? `${start.toLocaleString()}-${end.toLocaleString()} of ${pagination.total.toLocaleString()}` : "0 results"}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={disabled || page <= 1}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={disabled || page >= totalPages}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function CampaignsPanel({ token }: { token: string }) {
  const [statusFilter, setStatusFilter] = useState<CampaignEffectiveStatus | "all">("all");
  const [nameFilter, setNameFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignPagination, setCampaignPagination] = useState<Pagination>(emptyPagination);

  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [memberStatusFilter, setMemberStatusFilter] = useState<CampaignMember["status"] | "all">("all");
  const [memberPage, setMemberPage] = useState(1);
  const [memberPagination, setMemberPagination] = useState<Pagination>(emptyPagination);

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionPagination, setTransactionPagination] = useState<Pagination>(emptyPagination);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionUserId, setTransactionUserId] = useState("");
  const [transactionType, setTransactionType] = useState<"all" | "credit" | "debit">("all");
  const [transactionStatus, setTransactionStatus] = useState<"all" | "completed" | "failed">("all");
  const [transactionReference, setTransactionReference] = useState("");
  const [transactionFrom, setTransactionFrom] = useState("");
  const [transactionTo, setTransactionTo] = useState("");

  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [fundAmount, setFundAmount] = useState("500");
  const [fundMembers, setFundMembers] = useState("");
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [revokeUsers, setRevokeUsers] = useState("");
  const [cascadeDelete, setCascadeDelete] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<CampaignStatus>("active");
  const [editBudgetCap, setEditBudgetCap] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editCoversCvOptimization, setEditCoversCvOptimization] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );
  const bonusBalance = balance?.bonus?.balance ?? 0;
  const bonusItems = balance?.bonus?.items ?? [];
  const selectedIsEnded = selectedCampaign?.status === "ended" || selectedCampaign?.effectiveStatus === "ended";

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

  const selectCampaign = (campaign: Campaign) => {
    setSelectedCampaignId(campaign.id);
    setMembers([]);
    setMemberPagination(emptyPagination);
    setMemberPage(1);
  };

  const openEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setEditName(campaign.name || "");
    setEditDescription(campaign.description || "");
    setEditStatus(campaign.status);
    setEditBudgetCap(campaign.budgetCap == null ? "" : String(campaign.budgetCap));
    setEditExpiresAt(dateInputValue(campaign.expiresAt));
    setEditCoversCvOptimization(campaign.allowedTools.length === 0 || campaign.allowedTools.includes("cv_optimization"));
  };

  const loadMembers = useCallback(async (id = selectedCampaignId, page = memberPage) => {
    if (!id) {
      setMembers([]);
      setMemberPagination(emptyPagination);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const res = await listCampaignMembers({
        id,
        token,
        status: memberStatusFilter,
        page,
        limit: 10,
      });
      setMembers(res.data.members || []);
      setMemberPagination(res.data.pagination || emptyPagination);
      setMemberPage(res.data.pagination?.page || page);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [memberPage, memberStatusFilter, selectedCampaignId, showError, token]);

  const loadCampaigns = useCallback(async (page = campaignPage) => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await listCampaigns({
        token,
        status: statusFilter,
        name: nameFilter.trim(),
        createdFrom: isoDateBoundary(createdFrom, "start"),
        createdTo: isoDateBoundary(createdTo, "end"),
        includeDeleted,
        page,
        limit: 20,
      });
      const items = res.data.campaigns || [];
      setCampaigns(items);
      setCampaignPagination(res.data.pagination || emptyPagination);
      setCampaignPage(res.data.pagination?.page || page);
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
  }, [campaignPage, createdFrom, createdTo, includeDeleted, nameFilter, showError, statusFilter, token]);

  const loadTransactions = useCallback(async (page = transactionPage) => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await listAdminTransactions({
        token,
        userId: transactionUserId.trim(),
        type: transactionType,
        status: transactionStatus,
        reference: transactionReference.trim(),
        createdFrom: isoDateBoundary(transactionFrom, "start"),
        createdTo: isoDateBoundary(transactionTo, "end"),
        page,
        limit: 10,
      });
      setTransactions(res.data.transactions || []);
      setTransactionPagination(res.data.pagination || emptyPagination);
      setTransactionPage(res.data.pagination?.page || page);
      setNotice({ tone: "success", text: "Transactions refreshed." });
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [showError, token, transactionFrom, transactionPage, transactionReference, transactionStatus, transactionTo, transactionType, transactionUserId]);

  useEffect(() => {
    if (token) void loadCampaigns(1);
  }, [loadCampaigns, token]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), notice.tone === "error" ? 7000 : 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const handleStatusChange = async (status: CampaignStatus) => {
    if (!selectedCampaignId) return;
    if (selectedIsEnded && status === "active") {
      setNotice({ tone: "info", text: "Ended campaigns are terminal and cannot be reactivated." });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      await updateCampaign(selectedCampaignId, { status }, token);
      setNotice({ tone: "success", text: `Campaign marked ${status}.` });
      await loadCampaigns(campaignPage);
      await loadMembers(selectedCampaignId, memberPage);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCampaignId) return;
    setLoading(true);
    setNotice(null);
    try {
      await deleteCampaign(selectedCampaignId, { token, cascadeRevoke: cascadeDelete });
      setSelectedCampaignId("");
      setMembers([]);
      setNotice({
        tone: "success",
        text: cascadeDelete
          ? "Campaign deleted and unspent member bonus reclaimed."
          : "Campaign deleted. It will be hidden unless deleted campaigns are included.",
      });
      await loadCampaigns(1);
    } catch (err) {
      if (isRouteNotFound(err)) {
        setNotice({
          tone: "error",
          text: "Delete is not available on the deployed campaign backend yet. The frontend is calling DELETE /admin/campaigns/:id as documented.",
        });
      } else {
        showError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCampaign = async () => {
    if (!editingCampaign) return;
    if (!editName.trim()) {
      setNotice({ tone: "error", text: "Campaign name is required." });
      return;
    }
    const editingIsEnded = editingCampaign.status === "ended" || editingCampaign.effectiveStatus === "ended";
    if (editingIsEnded && editStatus !== "ended") {
      setNotice({ tone: "info", text: "Ended campaigns are terminal and cannot be reactivated." });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      await updateCampaign(
        editingCampaign.id,
        {
          name: editName.trim(),
          description: editDescription.trim(),
          status: editStatus,
          budgetCap: editBudgetCap ? Number(editBudgetCap) : null,
          allowedTools: editCoversCvOptimization ? ["cv_optimization"] : [],
          expiresAt: editExpiresAt ? new Date(`${editExpiresAt}T23:59:59.999`).toISOString() : null,
        },
        token
      );
      setNotice({ tone: "success", text: "Campaign updated." });
      setEditingCampaign(null);
      await loadCampaigns(campaignPage);
      if (selectedCampaignId === editingCampaign.id && members.length > 0) {
        await loadMembers(editingCampaign.id, memberPage);
      }
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async () => {
    if (!selectedCampaignId) return;
    const sharedAmount = Number(fundAmount);
    const parsedMembers = parseMembers(fundMembers, sharedAmount);

    if (parsedMembers.length === 0) {
      setNotice({ tone: "error", text: "Add at least one email or user ID to fund." });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const res = await bulkFundCampaignMembers(
        selectedCampaignId,
        { members: parsedMembers, amount: sharedAmount, notify: notifyMembers },
        token
      );
      const funded = res.data.funded?.length || 0;
      const unmatched = res.data.unmatched?.length || 0;
      setFundMembers("");
      setNotice({
        tone: unmatched ? "info" : "success",
        text: `Funded ${funded} member(s). ${unmatched} unmatched.`,
      });
      await loadCampaigns(campaignPage);
      await loadMembers(selectedCampaignId, 1);
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
      await loadCampaigns(campaignPage);
      await loadMembers(selectedCampaignId, memberPage);
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

  const handleConsent = async (value: boolean) => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await setBillingConsent(value, token);
      setBalance((current) =>
        current
          ? {
              ...current,
              autoBillWalletWhenBonusLow: res.data.autoBillWalletWhenBonusLow ?? value,
            }
          : current
      );
      await loadBalance();
      setNotice({
        tone: "success",
        text: value ? "Paid wallet backup is now on." : "Paid wallet backup now asks before each charge.",
      });
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      {notice && <ToastNotice tone={notice.tone} text={notice.text} onClose={() => setNotice(null)} />}
      {editingCampaign && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/45 px-4 py-6">
          <div className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-950">Edit Campaign</h3>
                <p className="mt-1 truncate text-sm text-slate-500">{editingCampaign.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCampaign(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                aria-label="Close edit campaign dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Campaign name
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  disabled={loading}
                  className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10 disabled:opacity-60"
                  placeholder="Campaign name"
                />
              </label>

              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Description
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  disabled={loading}
                  rows={4}
                  className="resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10 disabled:opacity-60"
                  placeholder="Description"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={editStatus}
                    onChange={(event) => setEditStatus(event.target.value as CampaignStatus)}
                    disabled={loading || editingCampaign.status === "ended" || editingCampaign.effectiveStatus === "ended"}
                    className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal capitalize outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10 disabled:opacity-60"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="ended">Ended</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Budget cap
                  <input
                    value={editBudgetCap}
                    onChange={(event) => setEditBudgetCap(event.target.value)}
                    type="number"
                    min="0"
                    disabled={loading}
                    className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10 disabled:opacity-60"
                    placeholder="Uncapped"
                  />
                </label>

                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Expiry date
                  <input
                    value={editExpiresAt}
                    onChange={(event) => setEditExpiresAt(event.target.value)}
                    type="date"
                    disabled={loading}
                    className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal outline-none focus:border-[#48C05C] focus:bg-white focus:ring-4 focus:ring-[#48C05C]/10 disabled:opacity-60"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={editCoversCvOptimization}
                  onChange={(event) => setEditCoversCvOptimization(event.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 accent-[#48C05C]"
                />
                Covers CV optimization
              </label>
            </div>

            <div className="grid gap-2 border-t border-slate-100 px-5 py-4 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingCampaign(null)}
                disabled={loading}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateCampaign}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#48C05C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3aa94e] disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#2f8f42]">
              <ShieldCheck className="h-4 w-4" />
              Promotional bonus admin
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Filter paginated campaigns, inspect members, and review wallet activity.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 xl:max-w-4xl">
            <div className="grid w-full gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-3">
              <input
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Campaign name"
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10"
              />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as CampaignEffectiveStatus | "all");
                  setCampaignPage(1);
                }}
                aria-label="Filter campaigns by status"
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm capitalize text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All statuses" : status}
                  </option>
                ))}
              </select>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(event) => setIncludeDeleted(event.target.checked)}
                  className="h-4 w-4 accent-[#48C05C]"
                />
                Include deleted
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Created from
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(event) => setCreatedFrom(event.target.value)}
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Created to
                <input
                  type="date"
                  value={createdTo}
                  onChange={(event) => setCreatedTo(event.target.value)}
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10"
                />
              </label>
              <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3 xl:col-span-3 xl:flex xl:justify-end">
                <Link
                  href="/campaigns/create"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#48C05C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3aa94e]"
                >
                  Create campaign
                </Link>
                <button
                  onClick={() => loadCampaigns(1)}
                  disabled={loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setCampaigns([]);
                    setMembers([]);
                    setTransactions([]);
                    setSelectedCampaignId("");
                    setEditingCampaign(null);
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
        </div>

      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          ["Campaigns", campaignPagination.total.toLocaleString()],
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

      <section className="grid gap-6">
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
              campaigns.map((campaign) => {
                const status = effectiveStatus(campaign);
                return (
                  <div
                    key={campaign.id}
                    onClick={() => selectCampaign(campaign)}
                    className={`rounded-xl border p-4 transition ${selectedCampaignId === campaign.id ? "border-[#48C05C] bg-[#48C05C]/10" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{campaign.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{campaign.code}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(status)}`}>
                        {status}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div><dt className="text-xs text-slate-500">Granted</dt><dd className="mt-1 font-medium text-slate-800">{currency(campaign.stats?.totalGranted || 0)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Remaining</dt><dd className="mt-1 font-medium text-slate-800">{currency(campaign.stats?.totalRemaining || 0)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Expires</dt><dd className="mt-1 font-medium text-slate-800">{dateText(campaign.expiresAt)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Budget</dt><dd className="mt-1 font-medium text-slate-800">{currency(campaign.budgetCap)}</dd></div>
                    </dl>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditCampaign(campaign);
                      }}
                      className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
            <div className="max-h-96 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Expires</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Granted</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Budget</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                        No campaigns loaded yet.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((campaign) => {
                      const status = effectiveStatus(campaign);
                      return (
                        <tr
                          key={campaign.id}
                          onClick={() => selectCampaign(campaign)}
                          className={`cursor-pointer transition hover:bg-slate-50 ${selectedCampaignId === campaign.id ? "bg-[#48C05C]/10" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-950">{campaign.name}</p>
                            <p className="text-xs text-slate-400">{campaign.code}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(status)}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{dateText(campaign.expiresAt)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(campaign.stats?.totalGranted || 0)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(campaign.stats?.totalRemaining || 0)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(campaign.budgetCap)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditCampaign(campaign);
                              }}
                              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <PageControls pagination={campaignPagination} onPageChange={(page) => loadCampaigns(page)} disabled={loading} />
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] 2xl:gap-8">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Campaign Members</h3>
              <p className="text-sm text-slate-500">Paginated members include user names, email, grant, spend, remaining, and status.</p>
            </div>
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-start">
              <div className="grid gap-2 sm:grid-cols-[minmax(180px,240px)_auto]">
              <select
                value={memberStatusFilter}
                onChange={(event) => {
                  setMemberStatusFilter(event.target.value as CampaignMember["status"] | "all");
                  setMemberPage(1);
                }}
                className="col-span-2 min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm capitalize text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10 sm:col-span-1"
              >
                {memberStatusOptions.map((status) => (
                  <option key={status} value={status}>{status === "all" ? "All members" : status}</option>
                ))}
              </select>
              <button
                onClick={() => loadMembers(selectedCampaignId, 1)}
                disabled={!selectedCampaignId || loading}
                className="col-span-2 min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:col-span-1"
              >
                Load members
              </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
              {(["active", "paused", "ended"] as CampaignStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={!selectedCampaignId || loading || (selectedIsEnded && status === "active")}
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium capitalize text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {status}
                </button>
              ))}
              </div>
            </div>
          </div>

          {selectedCampaign ? (
            <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Selected</p>
                <p className="truncate text-sm font-semibold text-slate-950">{selectedCampaign.name}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Status</p>
                <p className="text-sm font-semibold capitalize text-slate-950">{effectiveStatus(selectedCampaign)}</p>
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

          <div className="grid gap-3 md:hidden">
            {!members.length ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No members loaded.</p>
            ) : (
              members.map((member) => {
                const user = displayUser(member);
                return (
                  <div key={`${member.userId}-${user.primary}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{user.primary}</p>
                        {user.secondary && <p className="truncate text-xs text-slate-400">{user.secondary}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(member.status)}`}>{member.status}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div><dt className="text-xs text-slate-500">Granted</dt><dd className="font-medium text-slate-800">{currency(member.granted)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Spent</dt><dd className="font-medium text-slate-800">{currency(member.spent)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Left</dt><dd className="font-medium text-slate-800">{currency(member.remaining)}</dd></div>
                    </dl>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
            <div className="max-h-80 overflow-auto">
              <table className="min-w-[760px] text-sm">
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
                  {!members.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No members loaded.</td>
                    </tr>
                  ) : (
                    members.map((member) => {
                      const user = displayUser(member);
                      return (
                        <tr key={`${member.userId}-${user.primary}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-950">{user.primary}</p>
                            {user.secondary && <p className="text-xs text-slate-400">{user.secondary}</p>}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(member.granted)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(member.spent)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(member.remaining)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(member.status)}`}>{member.status}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <PageControls pagination={memberPagination} onPageChange={(page) => loadMembers(selectedCampaignId, page)} disabled={loading || !selectedCampaignId} />
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
                <input type="checkbox" checked={notifyMembers} onChange={(event) => setNotifyMembers(event.target.checked)} className="h-4 w-4 accent-[#48C05C]" />
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
              <h3 className="text-base font-semibold text-slate-950">Revoke / Delete</h3>
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
              className="mt-3 min-h-11 w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              Revoke unused credit
            </button>
            <label className="mt-4 flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={cascadeDelete} onChange={(event) => setCascadeDelete(event.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
              Reclaim unspent member bonus when deleting
            </label>
            <button
              onClick={handleDelete}
              disabled={!selectedCampaignId || loading}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete campaign
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] 2xl:gap-8">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#2f8f42]" />
                <h3 className="text-base font-semibold text-slate-950">Admin Wallet Ledger</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">Paginated transactions include the user summary from the backend.</p>
            </div>
            <div className="grid min-w-0 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
              <input value={transactionUserId} onChange={(event) => setTransactionUserId(event.target.value)} placeholder="User ID" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10" />
              <select value={transactionType} onChange={(event) => setTransactionType(event.target.value as "all" | "credit" | "debit")} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm capitalize text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10">
                <option value="all">All types</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
              <select value={transactionStatus} onChange={(event) => setTransactionStatus(event.target.value as "all" | "completed" | "failed")} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm capitalize text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10">
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <input value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} placeholder="Reference" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10" />
              <input type="date" value={transactionFrom} onChange={(event) => setTransactionFrom(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10" aria-label="Transaction created from" />
              <input type="date" value={transactionTo} onChange={(event) => setTransactionTo(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10" aria-label="Transaction created to" />
              <button onClick={() => loadTransactions(1)} disabled={loading} className="min-h-11 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 sm:col-span-2 lg:col-span-1 lg:justify-self-end lg:px-8">
                Load
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {!transactions.length ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No transactions loaded.</p>
            ) : (
              transactions.map((transaction) => {
                const user = displayUser(transaction);
                return (
                  <div key={transaction.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{user.primary}</p>
                        <p className="truncate text-xs text-slate-400">{transaction.reference || user.secondary}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(transaction.status)}`}>{transaction.status}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div><dt className="text-xs text-slate-500">Amount</dt><dd className="font-medium text-slate-800">{currency(transaction.amount)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Type</dt><dd className="font-medium capitalize text-slate-800">{transaction.type}</dd></div>
                      <div><dt className="text-xs text-slate-500">Date</dt><dd className="font-medium text-slate-800">{dateText(transaction.createdAt)}</dd></div>
                    </dl>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
            <div className="max-h-80 overflow-auto">
              <table className="min-w-[820px] text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!transactions.length ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No transactions loaded.</td>
                    </tr>
                  ) : (
                    transactions.map((transaction) => {
                      const user = displayUser(transaction);
                      return (
                        <tr key={transaction.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-950">{user.primary}</p>
                            {user.secondary && <p className="text-xs text-slate-400">{user.secondary}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{transaction.reference || "-"}</td>
                          <td className="px-4 py-3 capitalize text-slate-600">{transaction.type}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(transaction.status)}`}>{transaction.status}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(transaction.amount)}</td>
                          <td className="px-4 py-3 text-slate-600">{dateText(transaction.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <PageControls pagination={transactionPagination} onPageChange={(page) => loadTransactions(page)} disabled={loading} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <BadgeDollarSign className="h-4 w-4 text-[#2f8f42]" />
            <h3 className="text-base font-semibold text-slate-950">Paid Wallet Backup</h3>
          </div>
          <p className="text-sm leading-6 text-slate-500">
            Choose what should happen when a user's bonus credit is not enough to finish a CV improvement.
          </p>
          <button onClick={loadBalance} disabled={loading} className="mt-5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            Check wallet balance
          </button>
          <div className="mt-3 grid gap-2">
            <button onClick={() => handleConsent(true)} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#48C05C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3aa94e] disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" />
              Use paid wallet backup
            </button>
            <button onClick={() => handleConsent(false)} disabled={loading} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Ask before using paid wallet
            </button>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            Customer prompt: &ldquo;Your bonus credit does not cover the full amount. Use your paid wallet for the rest?&rdquo;
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#2f8f42]" />
          <h3 className="text-base font-semibold text-slate-950">User Wallet & Bonus View</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid balance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{balance ? currency(balance.balance) : "-"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bonus credit</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{balance ? currency(bonusBalance) : "-"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Spend source</p>
            <p className="mt-2 text-2xl font-semibold capitalize text-slate-950">{balance?.activeSource || "-"}</p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[720px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Bonus</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Expires</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tools</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!bonusItems.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No live bonus items loaded.</td>
                </tr>
              ) : (
                bonusItems.map((item) => (
                  <tr key={item.bonusId}>
                    <td className="px-4 py-3 text-slate-950">{item.bonusId}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{currency(item.remaining)}</td>
                    <td className="px-4 py-3 text-slate-600">{dateText(item.expiresAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{item.allowedTools?.join(", ") || "All tools"}</td>
                    <td className="px-4 py-3">
                      {item.campaignStatus ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(item.campaignStatus)}`}>
                          {item.campaignStatus}
                        </span>
                      ) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default CampaignsPanel;
