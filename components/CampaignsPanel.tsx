"use client";
import { Skeleton } from "@/components/Skeleton";

import { SidePanel } from "@/components/SidePanel";
import { FilterBar } from "@/components/FilterBar";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Pencil,
  Plus,
  Trash2,
  Users,
  UserMinus,
  Wallet,
} from "lucide-react";
import { CustomSelect } from "@/components/CustomSelect";
import { ToastNotice } from "@/components/ToastNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  bulkFundCampaignMembers,
  createCampaignFundJob,
  deleteCampaign,
  getCampaign,
  getCampaignFundJob,
  getCampaignReport,
  fundCampaignMember,
  getUserBalance,
  listAdminUsers,
  listAdminTransactions,
  listCampaignMembers,
  listCampaignFundJobs,
  listCampaigns,
  listCampaignServices,
  revokeCampaignMembers,
  selectAllAdminUsers,
  setBillingConsent,
  updateCampaign,
  type AdminUser,
  type Campaign,
  type CampaignEffectiveStatus,
  type CampaignMember,
  type CampaignReport,
  type CampaignService,
  type CampaignStatus,
  type FundJob,
  type Pagination,
  type UserBalance,
  type WalletTransaction,
} from "@/lib/api";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

type CampaignTab = "campaigns" | "overview" | "members" | "funding" | "report" | "settings" | "users" | "transactions" | "wallet";

const statusOptions: (CampaignEffectiveStatus | "all")[] = ["all", "active", "paused", "expired", "ended"];
const memberStatusOptions: (CampaignMember["status"] | "all")[] = ["all", "active", "exhausted", "revoked", "expired"];
const emptyPagination: Pagination = { total: 0, page: 1, limit: 20, totalPages: 1 };

const campaignStatusSelectOptions = statusOptions.map((status) => ({
  value: status,
  label: status === "all" ? "All statuses" : status,
}));

const editableStatusSelectOptions: { value: CampaignStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

const memberStatusSelectOptions = memberStatusOptions.map((status) => ({
  value: status,
  label: status === "all" ? "All members" : status,
}));

const bonusSelectOptions: { value: "all" | "true" | "false"; label: string }[] = [
  { value: "all", label: "Any bonus" },
  { value: "true", label: "Has bonus" },
  { value: "false", label: "No bonus" },
];

const transactionTypeSelectOptions: { value: "all" | "credit" | "debit"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "credit", label: "Credit" },
  { value: "debit", label: "Debit" },
];

const transactionStatusSelectOptions: { value: "all" | "completed" | "failed"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

function currency(value: number | null | undefined) {
  if (value === undefined) return "—";
  if (value === null) return "Uncapped";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function reportMetric(key: string, value: number) {
  return /count|members|users|requested|funded|skipped|revoked|notFound/i.test(key)
    ? value.toLocaleString()
    : currency(value);
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

function summaryText(prefix: string, summary?: { requested?: number; funded?: number; skipped?: number; totalCredited?: number; revoked?: number; notFound?: number; totalReclaimed?: number }) {
  if (!summary) return prefix;
  const parts = [
    summary.requested !== undefined ? `requested ${summary.requested}` : "",
    summary.funded !== undefined ? `funded ${summary.funded}` : "",
    summary.revoked !== undefined ? `revoked ${summary.revoked}` : "",
    summary.skipped !== undefined ? `skipped ${summary.skipped}` : "",
    summary.notFound !== undefined ? `not found ${summary.notFound}` : "",
    summary.totalCredited !== undefined ? `credited ${currency(summary.totalCredited)}` : "",
    summary.totalReclaimed !== undefined ? `reclaimed ${currency(summary.totalReclaimed)}` : "",
  ].filter(Boolean);
  return parts.length ? `${prefix}: ${parts.join(", ")}.` : prefix;
}

function serviceName(services: CampaignService[], id: string) {
  return services.find((service) => service.id === id)?.label || id.replace(/_/g, " ");
}

function jobId(job: FundJob) {
  return job.jobId || job.id || "";
}

function isFinalJobStatus(status: string) {
  return status === "completed" || status === "failed";
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
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<CampaignTab>("campaigns");
  const [statusFilter, setStatusFilter] = useState<CampaignEffectiveStatus | "all">("all");
  const [nameFilter, setNameFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignPagination, setCampaignPagination] = useState<Pagination>(emptyPagination);

  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignDetails, setCampaignDetails] = useState<Campaign | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [services, setServices] = useState<CampaignService[]>([]);
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

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userPagination, setUserPagination] = useState<Pagination>(emptyPagination);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userHasBonus, setUserHasBonus] = useState<"all" | "true" | "false">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedUserAmounts, setSelectedUserAmounts] = useState<Record<string, string>>({});
  const [selectAllTotal, setSelectAllTotal] = useState<number | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberToFund, setMemberToFund] = useState<CampaignMember | null>(null);
  const [singleFundAmount, setSingleFundAmount] = useState("500");

  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; confirmLabel: string; tone?: "default" | "danger"; onConfirm: () => void } | null>(null);

  const [fundAmount, setFundAmount] = useState("500");
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [fundJob, setFundJob] = useState<FundJob | null>(null);
  const [fundJobs, setFundJobs] = useState<FundJob[]>([]);
  const [jobStatus, setJobStatus] = useState<"all" | "queued" | "processing" | "completed" | "failed">("all");
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<CampaignStatus>("active");
  const [editBudgetCap, setEditBudgetCap] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editAllowedTools, setEditAllowedTools] = useState<string[]>([]);
  const [editNotify, setEditNotify] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const selectedCampaign = useMemo(
    () => campaignDetails || campaigns.find((campaign) => campaign.id === selectedCampaignId) || null,
    [campaignDetails, campaigns, selectedCampaignId]
  );
  const bonusBalance = balance?.bonus?.balance ?? 0;
  const bonusItems = balance?.bonus?.items ?? [];
  const selectedIsEnded = selectedCampaign?.status === "ended" || selectedCampaign?.effectiveStatus === "ended";
  const selectedEffectiveStatus = selectedCampaign ? effectiveStatus(selectedCampaign) : "";
  const selectedIsDeleted = selectedEffectiveStatus === "deleted" || Boolean(selectedCampaign?.deletedAt);
  const canFundSelected = Boolean(selectedCampaignId) && !loading && !selectedIsEnded && !selectedIsDeleted && selectedEffectiveStatus !== "expired";
  const intendedFundingTotal = selectAllTotal !== null
    ? selectAllTotal * (Number(fundAmount) || 0)
    : selectedUserIds.reduce((sum, id) => sum + (Number(selectedUserAmounts[id]) > 0 ? Number(selectedUserAmounts[id]) : Number(fundAmount) || 0), 0);
  const detailTabs: { id: CampaignTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "members", label: "Members", count: memberPagination.total },
    { id: "funding", label: "Funding", count: fundJob ? 1 : undefined },
    { id: "report", label: "Report" },
    { id: "settings", label: "Settings" },
  ];

  const showError = useCallback((err: unknown) => {
    setNotice({ tone: "error", text: userFacingError(err) });
  }, []);

  const selectCampaign = (campaign: Campaign, tab: CampaignTab = "overview") => {
    setSelectedCampaignId(campaign.id);
    setCampaignDetails(campaign);
    setMembers([]);
    setMemberPagination(emptyPagination);
    setMemberPage(1);
    setActiveTab(tab);
  };

  const returnToCampaigns = () => setActiveTab("campaigns");

  const openEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setEditName(campaign.name || "");
    setEditDescription(campaign.description || "");
    setEditStatus(campaign.status);
    setEditBudgetCap(campaign.budgetCap == null ? "" : String(campaign.budgetCap));
    setEditExpiresAt(dateInputValue(campaign.expiresAt));
    setEditAllowedTools(campaign.allowedTools || []);
    setEditNotify(true);
  };

  const toggleEditTool = (id: string) => {
    setEditAllowedTools((current) =>
      current.includes(id) ? current.filter((tool) => tool !== id) : [...current, id]
    );
  };

  const loadCampaignDetails = useCallback(async (id = selectedCampaignId) => {
    if (!id) {
      setCampaignDetails(null);
      return;
    }
    setDetailsLoading(true);
    try {
      const res = await getCampaign(id, token);
      setCampaignDetails(res.data.campaign);
    } catch (err) {
      showError(err);
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedCampaignId, showError, token]);

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
        budgetMin,
        budgetMax,
        page,
        limit: 20,
      });
      const items = res.data.campaigns || [];
      setCampaigns(items);
      setCampaignPagination(res.data.pagination || emptyPagination);
      setCampaignPage(res.data.pagination?.page || page);
      setSelectedCampaignId((currentId) => currentId && items.some((campaign) => campaign.id === currentId) ? currentId : "");
      setCampaignDetails((current) => current && items.some((campaign) => campaign.id === current.id) ? current : null);
      setNotice({ tone: "success", text: "Campaigns refreshed." });
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [budgetMax, budgetMin, campaignPage, createdFrom, createdTo, includeDeleted, nameFilter, showError, statusFilter, token]);

  const loadServices = useCallback(async () => {
    try {
      const res = await listCampaignServices(token);
      setServices(res.data.services || []);
    } catch (err) {
      showError(err);
    }
  }, [showError, token]);

  const loadUsers = useCallback(async (page = userPage) => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await listAdminUsers({
        token,
        name: userSearch.trim(),
        role: userRole.trim(),
        hasBonus: userHasBonus === "all" ? "all" : userHasBonus === "true",
        page,
        limit: 10,
      });
      setUsers(res.data.users || []);
      setUserPagination(res.data.pagination || emptyPagination);
      setUserPage(res.data.pagination?.page || page);
      setSelectAllTotal(null);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [showError, token, userHasBonus, userPage, userRole, userSearch]);

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

  const loadReport = useCallback(async () => {
    if (!selectedCampaignId) return;
    setLoading(true);
    try { const response = await getCampaignReport(selectedCampaignId, token); setReport(response.data); }
    catch (err) { showError(err); }
    finally { setLoading(false); }
  }, [selectedCampaignId, showError, token]);

  const loadFundJobs = useCallback(async () => {
    if (!selectedCampaignId) return;
    setLoading(true);
    try { const response = await listCampaignFundJobs(selectedCampaignId, token, { status: jobStatus, page: 1, limit: 20 }); setFundJobs(response.data.jobs || []); }
    catch (err) { showError(err); }
    finally { setLoading(false); }
  }, [jobStatus, selectedCampaignId, showError, token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status && ["active", "paused", "expired", "ended"].includes(status)) setStatusFilter(status as CampaignEffectiveStatus);
    setNameFilter(params.get("name") || "");
    setCreatedFrom(params.get("createdFrom") || "");
    setCreatedTo(params.get("createdTo") || "");
    setBudgetMin(params.get("budgetMin") || "");
    setBudgetMax(params.get("budgetMax") || "");
    setIncludeDeleted(params.get("includeDeleted") === "true");
    setCampaignPage(Math.max(1, Number(params.get("page")) || 1));
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (token && filtersHydrated) void loadCampaigns(campaignPage);
  }, [campaignPage, filtersHydrated, loadCampaigns, token]);

  useEffect(() => {
    if (!filtersHydrated) return;
    const params = new URLSearchParams(); params.set("view", "campaigns");
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (nameFilter.trim()) params.set("name", nameFilter.trim());
    if (createdFrom) params.set("createdFrom", createdFrom); if (createdTo) params.set("createdTo", createdTo);
    if (budgetMin) params.set("budgetMin", budgetMin); if (budgetMax) params.set("budgetMax", budgetMax);
    if (includeDeleted) params.set("includeDeleted", "true"); if (campaignPage > 1) params.set("page", String(campaignPage));
    window.history.replaceState(null, "", `/?${params.toString()}`);
  }, [budgetMax, budgetMin, campaignPage, createdFrom, createdTo, filtersHydrated, includeDeleted, nameFilter, statusFilter]);

  useEffect(() => {
    if (token) void loadServices();
  }, [loadServices, token]);

  useEffect(() => {
    if (selectedCampaignId) {
      void loadCampaignDetails(selectedCampaignId);
      void loadMembers(selectedCampaignId, 1);
    }
  }, [loadCampaignDetails, loadMembers, selectedCampaignId]);

  useEffect(() => {
    if (activeTab === "users" && users.length === 0) void loadUsers(1);
  }, [activeTab, loadUsers, users.length]);

  useEffect(() => {
    if (activeTab === "report") void loadReport();
    if (activeTab === "funding") void loadFundJobs();
  }, [activeTab, loadFundJobs, loadReport]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), notice.tone === "error" ? 7000 : 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const handleStatusChange = async (status: CampaignStatus, confirmed = false) => {
    if (!selectedCampaignId) return;
    if (selectedIsEnded && status === "active") {
      setNotice({ tone: "info", text: "Ended campaigns are terminal and cannot be reactivated." });
      return;
    }
    if (status === "ended" && !confirmed) {
      setConfirmation({ title: "End this campaign?", description: "Ending is terminal. This campaign will not be eligible for reactivation or future funding.", confirmLabel: "End campaign", tone: "danger", onConfirm: () => { void handleStatusChange(status, true); } });
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

  const handleDelete = async (confirmed = false) => {
    if (!selectedCampaignId || loading) return;
    if (selectedIsDeleted) {
      setNotice({ tone: "info", text: "Deleted campaigns do not offer delete or funding actions." });
      return;
    }
    if (!confirmed) {
      setConfirmation({ title: "Delete this campaign?", description: "This is a soft delete. Unspent member campaign credit may be forfeited or reclaimed according to the backend response.", confirmLabel: "Delete campaign", tone: "danger", onConfirm: () => { void handleDelete(true); } });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const res = await deleteCampaign(selectedCampaignId, { token });
      setSelectedCampaignId("");
      setCampaignDetails(null);
      setMembers([]);
      setActiveTab("campaigns");
      setNotice({
        tone: "success",
        text: res.data.summary
          ? summaryText("Campaign deleted and unused member bonuses forfeited", res.data.summary)
          : `Campaign deleted. ${res.data.forfeited?.length || 0} member bonus item(s) forfeited; ${currency((res.data.forfeited || []).reduce((sum, item) => sum + (item.reclaimed || 0), 0))} reclaimed.`,
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

  const handleUpdateCampaign = async (confirmed = false) => {
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
    const nextBudget = editBudgetCap ? Number(editBudgetCap) : null;
    if (nextBudget !== null && (!Number.isFinite(nextBudget) || nextBudget < 0)) {
      setNotice({ tone: "error", text: "Enter a valid non-negative budget cap." });
      return;
    }
    const nextExpiry = editExpiresAt ? new Date(`${editExpiresAt}T23:59:59.999`).toISOString() : null;
    if (nextExpiry && new Date(nextExpiry).getTime() <= Date.now()) {
      setNotice({ tone: "error", text: "Expiration must be in the future." });
      return;
    }
    if (editStatus === "ended" && editingCampaign.status !== "ended" && !confirmed) {
      setConfirmation({ title: "End this campaign while saving?", description: "Ending is terminal and cannot be undone through the admin workspace.", confirmLabel: "Save and end", tone: "danger", onConfirm: () => { void handleUpdateCampaign(true); } });
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
          budgetCap: nextBudget,
          allowedTools: editAllowedTools,
          expiresAt: nextExpiry,
        },
        token,
        { notify: editNotify }
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

  const pollFundJob = async (initialJob: FundJob) => {
    const id = jobId(initialJob);
    if (!id || !selectedCampaignId) return;
    let current = initialJob;
    for (let attempt = 0; attempt < 60 && !isFinalJobStatus(current.status); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      const res = await getCampaignFundJob(selectedCampaignId, id, token);
      current = res.data.job;
      setFundJob(current);
    }
    setNotice({
      tone: current.status === "completed" ? "success" : current.status === "failed" ? "error" : "info",
      text: current.summary
        ? summaryText(`Funding job ${jobId(current) || id} ${current.status}`, current.summary)
        : `Funding job ${jobId(current) || id} is ${current.status}.`,
    });
  };

  const handleSelectVisibleUser = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) =>
      checked ? Array.from(new Set([...current, userId])) : current.filter((id) => id !== userId)
    );
    setSelectAllTotal(null);
  };

  const handleSelectAllFilteredUsers = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await selectAllAdminUsers({
        token,
        name: userSearch.trim(),
        role: userRole.trim(),
        hasBonus: userHasBonus === "all" ? "all" : userHasBonus === "true",
      });
      setSelectedUserIds(res.data.userIds || []);
      setSelectAllTotal(res.data.total || 0);
      setNotice({ tone: "success", text: `${(res.data.total || 0).toLocaleString()} filtered user(s) selected for campaign funding.` });
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFundSelectedUsers = async () => {
    if (!selectedCampaignId) return;
    if (!canFundSelected) {
      setNotice({ tone: "info", text: "Funding is disabled for expired, ended, or deleted campaigns. Extend the expiry date to reactivate an expired campaign." });
      return;
    }
    const amount = Number(fundAmount);
    if (!amount || amount <= 0) {
      setNotice({ tone: "error", text: "Enter a funding amount above zero." });
      return;
    }
    if (!selectedUserIds.length) {
      setNotice({ tone: "error", text: "Select at least one user first." });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      if (selectAllTotal !== null) {
        const jobRes = await createCampaignFundJob(
          selectedCampaignId,
          { amount, members: selectedUserIds.map((userId) => ({ userId })), notify: notifyMembers },
          token
        );
        const job = jobRes.data.job;
        setFundJob(job);
        setNotice({ tone: "info", text: `Funding job ${jobId(job) || "started"} is ${job.status}.` });
        await pollFundJob(job);
      } else {
        const result = await bulkFundCampaignMembers(
          selectedCampaignId,
          { amount, notify: notifyMembers, members: selectedUserIds.map((userId) => ({ userId, amount: Number(selectedUserAmounts[userId]) > 0 ? Number(selectedUserAmounts[userId]) : undefined })) },
          token
        );
        const unmatched = result.data.unmatched?.length || 0;
        setNotice({ tone: unmatched ? "info" : "success", text: summaryText("Funding complete", result.data.summary) });
      }
      setSelectedUserIds([]);
      setSelectedUserAmounts({});
      setSelectAllTotal(null);
      await loadCampaigns(campaignPage);
      await loadMembers(selectedCampaignId, 1);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (ids = selectedMemberIds, confirmed = false) => {
    if (!selectedCampaignId) return;
    if (ids.length === 0) {
      setNotice({ tone: "error", text: "Select at least one campaign member to revoke." });
      return;
    }
    if (!confirmed) {
      setConfirmation({ title: "Revoke unspent campaign credit?", description: `This will revoke unused credit for ${ids.length} selected member(s). Spent credit remains, and only unused funds return to the campaign budget.`, confirmLabel: "Revoke credit", tone: "danger", onConfirm: () => { void handleRevoke(ids, true); } });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const res = await revokeCampaignMembers(selectedCampaignId, ids, token);
      setSelectedMemberIds([]);
      setNotice({
        tone: "success",
        text: summaryText(
          `Revoked ${res.data.revoked?.length || 0}; ${res.data.notFound?.length || 0} not found`,
          res.data.summary
        ),
      });
      await loadCampaigns(campaignPage);
      await loadMembers(selectedCampaignId, memberPage);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFundOne = async () => {
    if (!selectedCampaignId || !memberToFund) return;
    const amount = Number(singleFundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice({ tone: "error", text: "Enter a funding amount above zero." });
      return;
    }
    setLoading(true);
    try {
      await fundCampaignMember(selectedCampaignId, memberToFund.userId, { amount, notify: notifyMembers }, token);
      const memberName = displayUser(memberToFund).primary;
      setMemberToFund(null);
      setNotice({ tone: "success", text: `${memberName} received ${currency(amount)}.` });
      await loadCampaignDetails(selectedCampaignId);
      await loadMembers(selectedCampaignId, memberPage);
    } catch (err) { showError(err); }
    finally { setLoading(false); }
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
    <div className="campaigns-panel min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      {notice && !editingCampaign && <ToastNotice tone={notice.tone} text={notice.text} onClose={() => setNotice(null)} />}
      {confirmation && <ConfirmDialog open title={confirmation.title} description={confirmation.description} confirmLabel={confirmation.confirmLabel} tone={confirmation.tone} busy={loading} onClose={() => setConfirmation(null)} onConfirm={() => { const confirm = confirmation.onConfirm; setConfirmation(null); confirm(); }} />}
      {editingCampaign && (
        <SidePanel open title="Edit campaign" description={editingCampaign.code} onClose={() => setEditingCampaign(null)} busy={loading} footer={<>
          <button type="button" className="ui-button" disabled={loading} onClick={() => setEditingCampaign(null)}>Cancel</button>
          <button type="button" className="ui-button ui-primary" disabled={loading} onClick={() => void handleUpdateCampaign()}>{loading ? <Skeleton label="Saving changes" className="h-4 w-24" /> : "Save changes"}</button>
        </>}>
          {notice && <ToastNotice tone={notice.tone} text={notice.text} onClose={() => setNotice(null)} />}
            <div className="grid gap-4">
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
                  <CustomSelect
                    value={editStatus}
                    options={editableStatusSelectOptions}
                    onChange={setEditStatus}
                    disabled={loading || editingCampaign.status === "ended" || editingCampaign.effectiveStatus === "ended"}
                    ariaLabel="Campaign status"
                  />
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
                    className="custom-date min-h-11 text-sm font-normal disabled:opacity-60"
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
                          checked={editAllowedTools.includes(service.id)}
                          onChange={() => toggleEditTool(service.id)}
                          disabled={loading || !service.live}
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

              <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={editNotify}
                  onChange={(event) => setEditNotify(event.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 accent-[#48C05C]"
                />
                Notify members about expiry or service changes
              </label>
            </div>

        </SidePanel>
      )}

      {activeTab === "campaigns" && <FilterBar label="" summary={[nameFilter, statusFilter !== "all" ? statusFilter : "", createdFrom, createdTo, budgetMin && `Min ${budgetMin}`, budgetMax && `Max ${budgetMax}`, includeDeleted ? "Including deleted" : ""].filter(Boolean).join(" / ")}>
            <div className="filter-toolbar-layout">
              <div className="filter-toolbar-scroll">
                <div className="filter-toolbar-fields grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <input
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Campaign name"
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10"
              />
              <CustomSelect
                value={statusFilter}
                options={campaignStatusSelectOptions}
                onChange={(value) => {
                  setStatusFilter(value);
                  setCampaignPage(1);
                }}
                ariaLabel="Filter campaigns by status"
              />
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(event) => setIncludeDeleted(event.target.checked)}
                  className="h-4 w-4 accent-[#48C05C]"
                />
                Include deleted
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
                Created from
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(event) => setCreatedFrom(event.target.value)}
                  className="custom-date min-h-10 text-sm font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
                Created to
                <input
                  type="date"
                  value={createdTo}
                  onChange={(event) => setCreatedTo(event.target.value)}
                  className="custom-date min-h-10 text-sm font-normal"
                />
              </label>
              <input
                value={budgetMin}
                onChange={(event) => setBudgetMin(event.target.value)}
                type="number"
                min="0"
                placeholder="Budget min"
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10"
              />
              <input
                value={budgetMax}
                onChange={(event) => setBudgetMax(event.target.value)}
                type="number"
                min="0"
                placeholder="Budget max"
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10"
              />
                </div>
              </div>
              <div className="filter-actions">
                <button
                  onClick={() => {
                    setNameFilter(""); setStatusFilter("all"); setCreatedFrom(""); setCreatedTo("");
                    setBudgetMin(""); setBudgetMax(""); setIncludeDeleted(false); setCampaignPage(1);
                  }}
                  disabled={loading}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  Clear filters
                </button>
              </div>
            </div>
      </FilterBar>}

      {activeTab === "campaigns" ? null : selectedCampaign ? (
        <div className="campaign-detail-nav sticky top-[65px] z-10 overflow-x-auto rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm backdrop-blur lg:top-0">
          <div className="flex min-w-max items-center gap-1">
            <button type="button" onClick={returnToCampaigns} className="mr-2 inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"><ChevronLeft className="h-4 w-4" />Campaigns</button>
            <span className="mr-2 hidden h-5 w-px bg-slate-200 sm:block" />
            {detailTabs.map((tab) => {
              const isActive = activeTab === tab.id || (tab.id === "funding" && ["funding", "users", "transactions", "wallet"].includes(activeTab));
              return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`relative inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${isActive ? "bg-[#48C05C]/10 text-[#2f8f42]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`} aria-current={isActive ? "page" : undefined}><span>{tab.label}</span>{tab.count !== undefined && <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-white text-[#2f8f42]" : "bg-slate-100 text-slate-500"}`}>{tab.count.toLocaleString()}</span>}</button>;
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "campaigns" && (
      <section className="grid gap-6">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Campaign List</h3>
              <p className="text-sm text-slate-500">Newest first from the admin campaign endpoint.</p>
            </div>
            <Link href="/campaigns/create" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"><Plus className="h-4 w-4" />Add campaign</Link>
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
                      <div><dt className="text-xs text-slate-500">Granted</dt><dd className="mt-1 font-medium text-slate-800">{currency(campaign.stats?.totalGranted)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Spendable</dt><dd className="mt-1 font-medium text-slate-800">{currency(campaign.stats?.spendableRemaining)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Expires</dt><dd className="mt-1 font-medium text-slate-800">{dateText(campaign.expiresAt)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Budget</dt><dd className="mt-1 font-medium text-slate-800">{currency(campaign.budgetCap)}</dd></div>
                    </dl>
                    <button type="button" onClick={(event) => { event.stopPropagation(); openEditCampaign(campaign); }} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"><Pencil className="h-4 w-4" />Edit</button>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
            <div className="max-h-96 overflow-auto">
              <table className="campaign-table min-w-[900px] text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="w-14 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Expires</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Granted</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Spendable</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Budget</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                        No campaigns loaded yet.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((campaign, index) => {
                      const status = effectiveStatus(campaign);
                      return (
                        <tr
                          key={campaign.id}
                          onClick={() => selectCampaign(campaign)}
                          className={`cursor-pointer transition hover:bg-slate-50 ${selectedCampaignId === campaign.id ? "bg-[#48C05C]/10" : ""}`}
                        >
                          <td className="px-4 py-3 align-top text-slate-400 tabular-nums">{index + 1}</td>
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
                          <td className="px-4 py-3 text-right text-slate-600">{currency(campaign.stats?.totalGranted)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(campaign.stats?.spendableRemaining)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(campaign.budgetCap)}</td>
                          <td className="campaign-actions whitespace-nowrap px-4 py-3 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); openEditCampaign(campaign); }} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Edit</button></td>
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
      )}

      {activeTab === "overview" && selectedCampaign && (
        <section className="campaign-detail-hero surface p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(selectedEffectiveStatus)}`}>{selectedEffectiveStatus}</span><span className="text-xs text-slate-500">Campaign code {selectedCampaign.code}</span></div>
              <h2 className="mt-3 truncate text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{selectedCampaign.name}</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">{selectedCampaign.description || "No campaign description provided."}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2"><button type="button" className="ui-button" onClick={() => openEditCampaign(selectedCampaign)}><Pencil className="h-4 w-4" />Edit</button></div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[['Members', selectedCampaign.stats?.memberCount?.toLocaleString() ?? "—"], ['Budget', currency(selectedCampaign.budgetCap)], ['Granted', currency(selectedCampaign.stats?.totalGranted)], ['Spent', currency(selectedCampaign.stats?.totalSpent)], ['Spendable', currency(selectedCampaign.stats?.spendableRemaining)], ['Budget remaining', currency(selectedCampaign.stats?.budgetRemaining)]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-950" title={value}>{value}</p></div>)}
          </div>
        </section>
      )}

      {activeTab === "overview" && selectedCampaign && (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
          <div className="surface p-5 sm:p-6"><div className="mb-5"><p className="eyebrow">Campaign overview</p><h3 className="mt-1 text-base font-semibold">Details and eligibility</h3></div><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-medium text-slate-500">Created</dt><dd className="mt-1 text-sm font-medium">{dateText(selectedCampaign.createdAt)}</dd></div><div><dt className="text-xs font-medium text-slate-500">Last updated</dt><dd className="mt-1 text-sm font-medium">{dateText(selectedCampaign.updatedAt)}</dd></div><div><dt className="text-xs font-medium text-slate-500">Expires</dt><dd className="mt-1 text-sm font-medium">{dateText(selectedCampaign.expiresAt)}</dd></div><div><dt className="text-xs font-medium text-slate-500">Allowed services</dt><dd className="mt-1 text-sm font-medium">{selectedCampaign.allowedTools?.length ? selectedCampaign.allowedTools.map((tool) => serviceName(services, tool)).join(", ") : "No services specified"}</dd></div></dl><div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedCampaign.description || "No description provided."}</p></div></div>
          <div className="surface p-5 sm:p-6"><div className="mb-5"><p className="eyebrow">Budget health</p><h3 className="mt-1 text-base font-semibold">Utilization from campaign stats</h3></div>{selectedCampaign.budgetCap !== null && selectedCampaign.stats?.totalGranted !== undefined ? <><div className="flex items-end justify-between gap-3"><div><p className="text-3xl font-semibold tracking-tight">{Math.min(100, Math.round((selectedCampaign.stats.totalGranted / Math.max(selectedCampaign.budgetCap, 1)) * 100))}%</p><p className="text-xs text-slate-500">of budget granted</p></div><p className="text-right text-sm font-medium">{currency(selectedCampaign.stats.totalGranted)}<span className="font-normal text-slate-500"> / {currency(selectedCampaign.budgetCap)}</span></p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2f9e5b]" style={{ width: `${Math.min(100, Math.round((selectedCampaign.stats.totalGranted / Math.max(selectedCampaign.budgetCap, 1)) * 100))}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Budget remaining</p><p className="mt-1 font-semibold">{currency(selectedCampaign.stats.budgetRemaining)}</p></div><div><p className="text-xs text-slate-500">Spendable remaining</p><p className="mt-1 font-semibold">{currency(selectedCampaign.stats.spendableRemaining)}</p></div></div></> : <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">Budget utilization is unavailable because the backend did not return a budget cap and granted total.</div>}</div>
        </section>
      )}

      {activeTab === "settings" && selectedCampaign && (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)]">
          <div className="space-y-6"><div className="surface p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">General settings</p><h3 className="mt-1 text-base font-semibold">Campaign configuration</h3><p className="mt-1 text-sm text-slate-500">Update name, description, budget, services, and expiry together.</p></div><button type="button" className="ui-button" onClick={() => openEditCampaign(selectedCampaign)}><Pencil className="h-4 w-4" />Edit campaign</button></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Name</dt><dd className="mt-1 text-sm font-medium">{selectedCampaign.name}</dd></div><div><dt className="text-xs text-slate-500">Budget cap</dt><dd className="mt-1 text-sm font-medium">{currency(selectedCampaign.budgetCap)}</dd></div><div><dt className="text-xs text-slate-500">Expiry</dt><dd className="mt-1 text-sm font-medium">{dateText(selectedCampaign.expiresAt)}</dd></div><div><dt className="text-xs text-slate-500">Allowed services</dt><dd className="mt-1 text-sm font-medium">{selectedCampaign.allowedTools?.length ? selectedCampaign.allowedTools.map((tool) => serviceName(services, tool)).join(", ") : "No services specified"}</dd></div></dl></div><div className="surface p-5 sm:p-6"><p className="eyebrow">Lifecycle</p><h3 className="mt-1 text-base font-semibold">Change campaign state</h3><p className="mt-1 text-sm text-slate-500">Expired campaigns can be revived by extending their expiry date. Ended campaigns are terminal.</p><div className="mt-5 grid gap-2 sm:grid-cols-3">{(["active", "paused", "ended"] as CampaignStatus[]).map((status) => <button key={status} type="button" onClick={() => void handleStatusChange(status)} disabled={loading || (selectedIsEnded && status === "active")} className="ui-button capitalize">{status}</button>)}</div></div></div>
          <div className="surface h-fit border-rose-200 p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[.12em] text-rose-600">Danger zone</p><h3 className="mt-2 text-base font-semibold">Delete campaign</h3><p className="mt-2 text-sm leading-6 text-slate-500">This soft-deletes the campaign. Unspent member credit may be forfeited or reclaimed according to the backend response.</p><button type="button" className="ui-button ui-danger mt-5 w-full" disabled={loading || selectedIsDeleted} onClick={() => void handleDelete()}><Trash2 className="h-4 w-4" />Delete campaign</button></div>
        </section>
      )}

      {activeTab === "users" && (
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#2f8f42]" />
              <h3 className="text-base font-semibold text-slate-950">Admin Users</h3>
            </div>
            <p className="mt-1 text-sm text-slate-500">Server-side user filters support select-all funding without loading every page.</p>
          </div>
          <FilterBar label="" summary={[userSearch, userRole, userHasBonus !== "all" ? `Bonus: ${userHasBonus}` : ""].filter(Boolean).join(" / ") || "All users"}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10" />
            <input value={userRole} onChange={(event) => setUserRole(event.target.value)} placeholder="Role" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10" />
            <CustomSelect value={userHasBonus} options={bonusSelectOptions} onChange={setUserHasBonus} ariaLabel="Filter users by bonus" />
          </div>
          <div className="filter-actions mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4"><button onClick={() => loadUsers(1)} disabled={loading} className="min-h-11 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">Load users</button><button onClick={() => setSelectedUserIds((ids) => Array.from(new Set([...ids, ...users.map((user) => user.userId || user.id || "").filter(Boolean)])))} disabled={loading || !users.length} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Select visible page</button><button onClick={handleSelectAllFilteredUsers} disabled={loading} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Select all filtered</button><button onClick={() => { setSelectedUserIds([]); setSelectedUserAmounts({}); setSelectAllTotal(null); }} disabled={loading || !selectedUserIds.length} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Clear selection</button></div>
          </FilterBar>
          <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {selectAllTotal !== null
                ? `${selectAllTotal.toLocaleString()} filtered user(s) selected`
                : `${selectedUserIds.length.toLocaleString()} visible user(s) selected`}
            </span>
            <button onClick={() => setActiveTab("funding")} disabled={!canFundSelected || !selectedUserIds.length} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#48C05C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3aa94e] disabled:opacity-50">
              Continue to funding
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="mobile-card-table min-w-[820px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-14 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Select</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Amount override</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Bonus balance</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Bonus count</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!users.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">No users loaded.</td>
                </tr>
              ) : users.map((user, index) => {
                const summary = displayUser(user);
                const id = user.userId || user.id || "";
                return (
                  <tr key={id || summary.primary}>
                    <td data-label="#" className="px-4 py-3 align-top text-slate-400 tabular-nums">{index + 1}</td>
                    <td data-label="Select" className="px-4 py-3">
                      <input aria-label={`Select ${summary.primary}`} type="checkbox" checked={Boolean(id && selectedUserIds.includes(id))} disabled={!id || loading} onChange={(event) => handleSelectVisibleUser(id, event.target.checked)} className="h-4 w-4 accent-[#48C05C]" />
                    </td>
                    <td data-label="User" className="px-4 py-3">
                      <p className="font-medium text-slate-950">{summary.primary}</p>
                      {summary.secondary && <p className="text-xs text-slate-400">{summary.secondary}</p>}
                    </td>
                    <td data-label="Role" className="px-4 py-3 text-slate-600">{user.role || "-"}</td>
                    <td data-label="Amount override" className="px-4 py-3"><input type="number" min="1" placeholder="Shared" disabled={!id || !selectedUserIds.includes(id) || selectAllTotal !== null} value={selectedUserAmounts[id] || ""} onChange={(event) => setSelectedUserAmounts((values) => ({ ...values, [id]: event.target.value }))} className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"/></td>
                    <td data-label="Bonus balance" className="px-4 py-3 text-right text-slate-600">{currency(user.bonusBalance || 0)}</td>
                    <td data-label="Bonus count" className="px-4 py-3 text-right text-slate-600">{(user.bonusCount || 0).toLocaleString()}</td>
                    <td data-label="Created" className="px-4 py-3 text-slate-600">{dateText(user.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PageControls pagination={userPagination} onPageChange={(page) => loadUsers(page)} disabled={loading} />
      </section>
      )}

      {(activeTab === "members" || activeTab === "funding") && (
      <section className="grid gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] 2xl:gap-8">
        {activeTab === "members" && (
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Campaign Members</h3>
              <p className="text-sm text-slate-500">Paginated members include user names, email, grant, spend, remaining, and status.</p>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-600">{selectedMemberIds.length} member(s) selected</span>
              <div className="campaign-member-actions flex gap-2">
                <button type="button" className="ui-button" disabled={!members.length || loading} onClick={() => setSelectedMemberIds(members.filter((member) => member.status === "active").map((member) => member.userId))}>Select active page</button>
                <button type="button" className="ui-button border-rose-200 text-rose-700" disabled={!selectedMemberIds.length || loading} onClick={() => void handleRevoke()}>Revoke selected</button>
              </div>
            </div>
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-start">
              <div className="grid gap-2 sm:grid-cols-[minmax(180px,240px)_auto]">
              <CustomSelect
                value={memberStatusFilter}
                options={memberStatusSelectOptions}
                onChange={(value) => {
                  setMemberStatusFilter(value);
                  setMemberPage(1);
                }}
                ariaLabel="Filter campaign members"
                className="col-span-2 sm:col-span-1"
              />
              <button
                onClick={() => loadMembers(selectedCampaignId, 1)}
                disabled={!selectedCampaignId || loading}
                className="col-span-2 min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:col-span-1"
              >
                Load members
              </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
            <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Selected</p>
                <p className="truncate text-sm font-semibold text-slate-950">{selectedCampaign.name}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Status</p>
                <p className="text-sm font-semibold capitalize text-slate-950">{detailsLoading ? <Skeleton label="Loading campaign status" className="h-4 w-20" /> : effectiveStatus(selectedCampaign)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Members</p>
                <p className="text-sm font-semibold text-slate-950">{selectedCampaign.stats?.memberCount?.toLocaleString() ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Expires</p>
                <p className="text-sm font-semibold text-slate-950">{dateText(selectedCampaign.expiresAt)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Budget left</p>
                <p className="text-sm font-semibold text-slate-950">
                  {currency(selectedCampaign.stats?.budgetRemaining ?? (selectedCampaign.budgetCap != null && selectedCampaign.stats?.totalGranted !== undefined ? selectedCampaign.budgetCap - selectedCampaign.stats.totalGranted : undefined))}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Spendable left</p>
                <p className="text-sm font-semibold text-slate-950">{currency(selectedCampaign.stats?.spendableRemaining)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Services</p>
                <p className="truncate text-sm font-semibold capitalize text-slate-950">
                  {selectedCampaign.allowedTools?.length
                    ? selectedCampaign.allowedTools.map((tool) => serviceName(services, tool)).join(", ")
                    : "No services specified"}
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
                      <div className="flex min-w-0 items-start gap-3"><input type="checkbox" aria-label={`Select ${user.primary}`} disabled={member.status !== "active"} checked={selectedMemberIds.includes(member.userId)} onChange={(event) => setSelectedMemberIds((ids) => event.target.checked ? [...new Set([...ids, member.userId])] : ids.filter((id) => id !== member.userId))} className="mt-1 h-4 w-4 accent-[#48C05C]"/><div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{user.primary}</p>
                        {user.secondary && <p className="truncate text-xs text-slate-400">{user.secondary}</p>}
                      </div></div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(member.status)}`}>{member.status}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div><dt className="text-xs text-slate-500">Granted</dt><dd className="font-medium text-slate-800">{currency(member.granted)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Spent</dt><dd className="font-medium text-slate-800">{currency(member.spent)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Left</dt><dd className="font-medium text-slate-800">{currency(member.remaining)}</dd></div>
                    </dl>
                    <p className="mt-3 text-xs text-slate-500">
                      {member.spendable ? "Spendable now" : "Not currently spendable"} · {dateText(member.expiresAt)}
                    </p>
                    {member.status === "active" && <button type="button" className="mt-3 text-sm font-medium text-rose-700" onClick={() => void handleRevoke([member.userId])}>Revoke unused credit</button>}
                    <button type="button" className="ml-4 mt-3 text-sm font-medium text-emerald-700" onClick={() => { setSingleFundAmount("500"); setMemberToFund(member); }}>Add funds</button>
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
                    <th className="w-14 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Select</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Granted</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Spent</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Spendable</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tools</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!members.length ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-sm text-slate-500">No members loaded.</td>
                    </tr>
                  ) : (
                    members.map((member, index) => {
                      const user = displayUser(member);
                      return (
                        <tr key={`${member.userId}-${user.primary}`}>
                          <td className="px-4 py-3 align-top text-slate-400 tabular-nums">{index + 1}</td>
                          <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${user.primary}`} disabled={member.status !== "active"} checked={selectedMemberIds.includes(member.userId)} onChange={(event) => setSelectedMemberIds((ids) => event.target.checked ? [...new Set([...ids, member.userId])] : ids.filter((id) => id !== member.userId))} className="h-4 w-4 accent-[#48C05C]"/></td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-950">{user.primary}</p>
                            {user.secondary && <p className="text-xs text-slate-400">{user.secondary}</p>}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(member.granted)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(member.spent)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{currency(member.remaining)}</td>
                          <td className="px-4 py-3 text-slate-600">{member.spendable ? "Yes" : "No"}</td>
                          <td className="px-4 py-3 text-slate-600">{member.allowedTools?.length ? member.allowedTools.map((tool) => serviceName(services, tool)).join(", ") : "Not specified"}</td>
                          <td className="px-4 py-3 text-slate-600">{dateText(member.expiresAt)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(member.status)}`}>{member.status}</span>
                          </td>
                          <td className="px-4 py-3"><button type="button" className="text-sm font-medium text-emerald-700" onClick={() => { setSingleFundAmount("500"); setMemberToFund(member); }}>Add funds</button></td>
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
        )}

        {activeTab === "funding" && (
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
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">Visual user selection</p>
                <p className="mt-1 text-sm text-slate-500">{selectAllTotal !== null ? `${selectAllTotal.toLocaleString()} matching users selected` : `${selectedUserIds.length.toLocaleString()} users selected`}. Search, filter, choose a page, or select every matching account in the Users tab.</p>
                <button type="button" className="ui-button mt-3" onClick={() => setActiveTab("users")}><Users size={16}/>{selectedUserIds.length ? "Review selected users" : "Choose users"}</button>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-emerald-50 p-4 text-sm"><div><p className="text-emerald-700">Recipients</p><p className="mt-1 font-semibold text-emerald-950">{(selectAllTotal ?? selectedUserIds.length).toLocaleString()}</p></div><div><p className="text-emerald-700">Intended allocation</p><p className="mt-1 font-semibold text-emerald-950">{currency(intendedFundingTotal)}</p></div></div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={notifyMembers} onChange={(event) => setNotifyMembers(event.target.checked)} className="h-4 w-4 accent-[#48C05C]" />
                Notify funded users
              </label>
              <button
                onClick={handleFundSelectedUsers}
                disabled={!canFundSelected || !selectedUserIds.length || Number(fundAmount) <= 0}
                className="mt-auto min-h-11 w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Fund selected campaign
              </button>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-4"><button type="button" className="ui-button" onClick={() => setActiveTab("transactions")}><Wallet className="h-4 w-4" />Transactions</button><button type="button" className="ui-button" onClick={() => setActiveTab("wallet")}><BadgeDollarSign className="h-4 w-4" />Wallet</button></div>
              {fundJob && (
                <div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                  <p className="font-medium capitalize text-slate-700">Job {jobId(fundJob) || "-"} · {fundJob.status}</p>
                  <p>Progress: {fundJob.progress ?? 0}%</p>
                  {fundJob.summary && <p>{summaryText("Summary", fundJob.summary)}</p>}
                  {fundJob.error && <p className="text-rose-600">{fundJob.error}</p>}
                </div>
              )}
              <div className="mt-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Funding jobs</p><CustomSelect value={jobStatus} options={[{value:"all",label:"All"},{value:"queued",label:"Queued"},{value:"processing",label:"Processing"},{value:"completed",label:"Completed"},{value:"failed",label:"Failed"}]} onChange={setJobStatus} ariaLabel="Funding job status" className="w-36"/></div>
                <div className="mt-3 space-y-2">{fundJobs.length ? fundJobs.map((job) => <div key={jobId(job)} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-medium">{jobId(job) || "Funding job"}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${statusClass(job.status)}`}>{job.status}</span></div><p className="mt-1 text-xs text-slate-500">Progress: {job.progress ?? 0}% · Created {dateText(job.createdAt)}</p>{job.summary && <p className="mt-1 text-xs text-slate-600">{summaryText("Result", job.summary)}</p>}{job.error && <p className="mt-1 text-xs text-rose-700">{job.error}</p>}</div>) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No funding jobs in this status.</p>}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-rose-600" />
              <h3 className="text-base font-semibold text-slate-950">Revoke / Delete</h3>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              Select active members from the Members tab. IDs are taken from the selected records and are never entered manually.
              <p className="mt-2 font-medium text-slate-800">{selectedMemberIds.length} member(s) selected</p>
              <button type="button" className="ui-button mt-3" onClick={() => setActiveTab("members")}><Users size={16}/>Choose members</button>
            </div>
            <button
              onClick={() => void handleRevoke()}
              disabled={!selectedCampaignId || loading || !selectedMemberIds.length}
              className="mt-3 min-h-11 w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              Revoke unused credit
            </button>
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
              Deleting a campaign automatically forfeits unused member bonuses.
            </p>
            <button
              onClick={() => void handleDelete()}
              disabled={!selectedCampaignId || loading || selectedIsDeleted}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete campaign
            </button>
          </div>
        </div>
        )}
      </section>
      )}
      {memberToFund && <SidePanel open title="Fund member" description={`${displayUser(memberToFund).primary} · ${displayUser(memberToFund).secondary}`} onClose={() => setMemberToFund(null)} busy={loading} footer={<><button className="ui-button" onClick={() => setMemberToFund(null)}>Cancel</button><button className="ui-button ui-primary" disabled={loading || Number(singleFundAmount) <= 0} onClick={() => void handleFundOne()}>Add funds</button></>}><div className="grid gap-4"><label className="grid gap-1 text-sm font-medium">Amount (NGN)<input type="number" min="1" value={singleFundAmount} onChange={(event) => setSingleFundAmount(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 px-3"/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifyMembers} onChange={(event) => setNotifyMembers(event.target.checked)}/>Notify the member by email</label></div></SidePanel>}

      {activeTab === "report" && (
        <section className="space-y-5">
          {!selectedCampaignId ? <div className="surface p-10 text-center text-sm text-slate-500">Select a campaign first.</div> : !report ? <div className="surface p-10 text-center text-sm text-slate-500">{loading ? "Loading report…" : "No report returned."}</div> : <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(report.stats || {}).filter(([,value]) => typeof value === "number").map(([key,value]) => <div key={key} className="surface p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key.replace(/([a-z])([A-Z])/g,"$1 $2")}</p><p className="mt-2 text-xl font-semibold">{reportMetric(key, value as number)}</p></div>)}</div>
            <div className="surface overflow-hidden"><div className="border-b p-5"><h3 className="font-semibold">Member breakdown</h3><p className="mt-1 text-sm text-slate-500">Values come directly from the campaign report endpoint.</p></div><div className="overflow-x-auto"><table className="mobile-card-table min-w-[700px] text-sm"><thead className="bg-slate-50"><tr>{["#","Member","Granted","Spent","Remaining","Status"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y">{report.members.map((member, index) => { const user=displayUser(member); return <tr key={member.userId}><td data-label="#" className="px-4 py-3 text-slate-400 tabular-nums">{index + 1}</td><td data-label="Member" className="px-4 py-3"><p className="font-medium">{user.primary}</p><p className="text-xs text-slate-500">{user.secondary}</p></td><td data-label="Granted" className="px-4 py-3">{currency(member.granted)}</td><td data-label="Spent" className="px-4 py-3">{currency(member.spent)}</td><td data-label="Remaining" className="px-4 py-3">{currency(member.remaining)}</td><td data-label="Status" className="px-4 py-3 capitalize">{member.status}</td></tr>; })}</tbody></table></div></div>
          </>}
        </section>
      )}

      {(activeTab === "transactions" || activeTab === "wallet") && (
      <section className="grid gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] 2xl:gap-8">
        <div className="2xl:col-span-2"><button type="button" className="ui-button" onClick={() => setActiveTab("funding")}><ChevronLeft className="h-4 w-4" />Back to funding</button></div>
        {activeTab === "transactions" && (
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#2f8f42]" />
                <h3 className="text-base font-semibold text-slate-950">Admin Wallet Ledger</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">Paginated transactions include the user summary from the backend.</p>
            </div>
            <FilterBar label="" summary={[transactionUserId, transactionReference, transactionType !== "all" ? transactionType : "", transactionStatus !== "all" ? transactionStatus : "", transactionFrom, transactionTo].filter(Boolean).join(" / ") || "All transactions"}>
            <div className="filter-toolbar-layout">
              <div className="filter-toolbar-scroll">
                <div className="filter-toolbar-fields grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <input value={transactionUserId} onChange={(event) => setTransactionUserId(event.target.value)} placeholder="User ID" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10" />
              <CustomSelect value={transactionType} options={transactionTypeSelectOptions} onChange={setTransactionType} ariaLabel="Filter transactions by type" />
              <CustomSelect value={transactionStatus} options={transactionStatusSelectOptions} onChange={setTransactionStatus} ariaLabel="Filter transactions by status" />
              <input value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} placeholder="Reference" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#48C05C] focus:ring-4 focus:ring-[#48C05C]/10" />
              <input type="date" value={transactionFrom} onChange={(event) => setTransactionFrom(event.target.value)} className="custom-date min-h-11 text-sm" aria-label="Transaction created from" />
              <input type="date" value={transactionTo} onChange={(event) => setTransactionTo(event.target.value)} className="custom-date min-h-11 text-sm" aria-label="Transaction created to" />
                </div>
              </div>
              <div className="filter-actions"><button onClick={() => loadTransactions(1)} disabled={loading} className="min-h-11 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 lg:px-8">
                Load
              </button></div>
            </div>
            </FilterBar>
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
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
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
                    <th className="w-14 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
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
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No transactions loaded.</td>
                    </tr>
                  ) : (
                    transactions.map((transaction, index) => {
                      const user = displayUser(transaction);
                      return (
                        <tr key={transaction.id}>
                          <td className="px-4 py-3 align-top text-slate-400 tabular-nums">{index + 1}</td>
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
        )}

        {activeTab === "wallet" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <BadgeDollarSign className="h-4 w-4 text-[#2f8f42]" />
            <h3 className="text-base font-semibold text-slate-950">Paid Wallet Backup</h3>
          </div>
          <p className="text-sm leading-6 text-slate-500">
            Choose what should happen when a user&apos;s bonus credit is not enough to finish a CV improvement.
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
        )}
      </section>
      )}

      {activeTab === "wallet" && (
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
          <table className="mobile-card-table min-w-[720px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-14 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
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
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">No live bonus items loaded.</td>
                </tr>
              ) : (
                bonusItems.map((item, index) => (
                  <tr key={item.bonusId}>
                    <td data-label="#" className="px-4 py-3 text-slate-400 tabular-nums">{index + 1}</td>
                    <td data-label="Bonus" className="px-4 py-3 text-slate-950">{item.bonusId}</td>
                    <td data-label="Remaining" className="px-4 py-3 text-right text-slate-600">{currency(item.remaining)}</td>
                    <td data-label="Expires" className="px-4 py-3 text-slate-600">{dateText(item.expiresAt)}</td>
                    <td data-label="Tools" className="px-4 py-3 text-slate-600">{item.allowedTools?.join(", ") || "Not specified"}</td>
                    <td data-label="Campaign status" className="px-4 py-3">
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
      )}
    </div>
  );
}

export default CampaignsPanel;
