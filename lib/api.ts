// lib/api.ts
import type { AdminSession } from "@/lib/adminSession";
const API_BASE_URL = "https://jobs.api.mastaskillz.com";
const AUTH_BASE_URL = "/api/auth";

/* ------------------------------------------------------------------ */
/*                               TYPES                                */
/* ------------------------------------------------------------------ */

export type TopPerformer = {
  shortCode: string;
  clicks: number;
  jobTitle: string;
  location: string;
  originalUrl: string;

  // ✅ new optional fields
  firstClickAt?: string; // ISO
  lastClickAt?: string;  // ISO
  timestamps?: string[]; // newest -> oldest (when timestamps=true)
};

export type SummaryResponse = {
  success: boolean;
  data: {
    today: { clicks: number; uniqueUrls: number };
    yesterday: { clicks: number; uniqueUrls: number };
    thisWeek: {
      clicks: number;
      uniqueUrls: number;
      topPerformers?: TopPerformer[];
    };
    thisMonth: {
      clicks: number;
      uniqueUrls: number;
      topPerformers?: TopPerformer[];
      locationBreakdown?: Record<string, number>;
      jobTitleBreakdown?: Record<string, number>;
    };
  };
};

export type SummaryData = SummaryResponse["data"];

export type DailyBreakdown = {
  date: string; // "YYYY-MM-DD"
  totalClicks: number;
  uniqueUrls: number;

  // topShortCodes may include first/last/timestamps when timestamps=true
  topShortCodes: TopPerformer[];

  locationBreakdown: Record<string, number>;
  jobTitleBreakdown: Record<string, number>;
};

export type WeeklyResponse = {
  success: boolean;
  data: {
    totalClicks: number;
    uniqueUrls: number;
    dailyBreakdown: DailyBreakdown[];
    topPerformers: TopPerformer[];
    locationBreakdown: Record<string, number>;
    jobTitleBreakdown: Record<string, number>;
  };
};

export type WeeklyData = WeeklyResponse["data"];
export type MonthlyResponse = WeeklyResponse;
export type MonthlyData = MonthlyResponse["data"];
export type RangeResponse = WeeklyResponse;
export type RangeData = RangeResponse["data"];

export type TimeRange = "today" | "yesterday" | "thisWeek" | "thisMonth";

export type CampaignStatus = "active" | "paused" | "ended";
export type CampaignEffectiveStatus = CampaignStatus | "expired" | "deleted";

export type CampaignStats = {
  memberCount: number;
  totalGranted: number;
  totalRemaining: number;
  totalSpent: number;
  spendableRemaining?: number;
  budgetRemaining?: number | null;
};

export type Campaign = {
  id: string;
  code: string;
  name: string;
  description: string;
  status: CampaignStatus;
  effectiveStatus?: CampaignEffectiveStatus;
  budgetCap: number | null;
  allowedTools: string[];
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  stats?: CampaignStats;
};

export type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CampaignService = {
  id: string;
  label: string;
  description?: string;
  live: boolean;
};

export type UserSummary = {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

export type CampaignMember = {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  user?: UserSummary;
  granted: number;
  remaining: number;
  spent: number;
  status: "active" | "exhausted" | "revoked" | "expired";
  spendable?: boolean;
  allowedTools?: string[];
  expiresAt?: string | null;
  grantedAt?: string;
};

export type CampaignReport = {
  campaign: Campaign;
  members: CampaignMember[];
  stats: CampaignStats;
};

export type CampaignEnvelope<T> = {
  code: number;
  status: "Success" | "Error";
  message?: string;
  data: T;
};

export type CreateCampaignInput = {
  name: string;
  description?: string;
  allowedTools?: string[];
  budgetCap?: number | null;
  expiresAt?: string | null;
};

export type UpdateCampaignInput = Partial<
  Pick<Campaign, "name" | "description" | "status" | "budgetCap" | "allowedTools" | "expiresAt">
>;

export type FundMemberInput = {
  userId?: string;
  email?: string;
  amount?: number;
};

export type FundingSummary = {
  requested?: number;
  funded?: number;
  skipped?: number;
  totalCredited?: number;
};

export type RevokeSummary = {
  requested?: number;
  revoked?: number;
  notFound?: number;
  totalReclaimed?: number;
};

export type FundJob = {
  id?: string;
  jobId?: string;
  status: "queued" | "processing" | "completed" | "failed" | string;
  progress?: number;
  summary?: FundingSummary;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminUser = UserSummary & {
  role?: string;
  isAdmin?: boolean;
  createdAt?: string;
  bonusBalance?: number;
  bonusCount?: number;
};

export type UserBalance = {
  balance: number;
  currency: string;
  bonus: {
    balance: number;
    items: {
      bonusId: string;
      source: string;
      sourceId: string;
      remaining: number;
      expiresAt: string | null;
      allowedTools: string[] | null;
      campaignStatus?: CampaignEffectiveStatus;
    }[];
  };
  activeSource: "bonus" | "paid";
  autoBillWalletWhenBonusLow: boolean;
};

export type WalletTransaction = {
  id: string;
  userId?: string;
  user?: UserSummary;
  type: "credit" | "debit" | string;
  status: "completed" | "failed" | string;
  amount: number;
  reference?: string | null;
  description?: string | null;
  balanceBefore?: number;
  balanceAfter?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AdminTransaction = WalletTransaction;

type UserBalanceResponseData = UserBalance | { balance: UserBalance };

/* ------------------------------------------------------------------ */
/*                             FETCH HELPERS                          */
/* ------------------------------------------------------------------ */

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("We could not load that data. Please try again.");
  return res.json() as Promise<T>;
}

async function fetchAuthJson<T>(
  path: string,
  opts?: RequestInit & { token?: string }
): Promise<T> {
  const headers = new Headers(opts?.headers);
  if (!headers.has("Content-Type") && opts?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (opts?.token) {
    headers.set("Authorization", `Bearer ${opts.token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${AUTH_BASE_URL}${path}`, {
      ...opts,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error("Could not reach the admin service. Please try again.");
  }

  const body = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    code?: number;
  };

  if (!res.ok || (body.code && body.code >= 400) || (body as { success?: boolean }).success === false || (body as { status?: string }).status === "Error") {
    const message =
      res.status === 402 || body.code === 402
        ? "Paid wallet approval is needed before this charge can continue."
        : body.message || `Request failed: ${res.status}`;
    throw Object.assign(new Error(message), {
      status: res.status,
      body,
    });
  }

  return body as T;
}

type LoginResponse = Record<string, unknown> & {
  data?: Record<string, unknown>;
};

function pickToken(body: LoginResponse) {
  const data = body.data;
  const candidates = [
    body.accessToken,
    body.access_token,
    body.token,
    body.access,
    body.jwt,
    data?.accessToken,
    data?.access_token,
    data?.token,
    data?.access,
  ];
  return candidates.find((value): value is string => typeof value === "string" && value.length > 0) || null;
}

function pickString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

export async function loginAdmin(
  email: string,
  password: string,
  role: "job_seeker" | "employer"
): Promise<AdminSession> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      role,
      accountType: role,
      userType: role,
    }),
  });
  const response = (await res.json().catch(() => ({}))) as LoginResponse & { message?: string };
  if (!res.ok) {
    throw Object.assign(new Error(response.message || `Login failed: ${res.status}`), {
      status: res.status,
      body: response,
    });
  }
  const token = pickToken(response);
  if (!token) throw new Error("Login succeeded, but the server did not return an access token.");

  const data = response.data;
  const firstName = pickString(data?.firstName, data?.first_name, response.firstName, response.first_name);
  const lastName = pickString(data?.lastName, data?.last_name, response.lastName, response.last_name);
  const fullName = pickString(
    data?.name,
    data?.fullName,
    data?.full_name,
    response.name,
    response.fullName,
    response.full_name,
    [firstName, lastName].filter(Boolean).join(" ")
  );

  return {
    token,
    email,
    displayName: fullName || email,
    role,
  };
}

function withTimestamps(url: string, timestamps?: boolean) {
  if (!timestamps) return url;
  const u = new URL(url);
  u.searchParams.set("timestamps", "true");
  return u.toString();
}

export async function fetchSummary(opts?: { timestamps?: boolean }) {
  const url = withTimestamps(`${API_BASE_URL}/analytics/summary`, opts?.timestamps);
  return fetchJson<SummaryResponse>(url);
}

export async function fetchWeekly(opts?: { date?: string; timestamps?: boolean }) {
  const u = new URL(`${API_BASE_URL}/analytics/weekly`);
  if (opts?.date) u.searchParams.set("date", opts.date);
  if (opts?.timestamps) u.searchParams.set("timestamps", "true");
  return fetchJson<WeeklyResponse>(u.toString());
}

export async function fetchMonthly(
  year: number,
  month: number,
  opts?: { timestamps?: boolean }
) {
  const u = new URL(`${API_BASE_URL}/analytics/monthly`);
  u.searchParams.set("year", String(year));
  u.searchParams.set("month", String(month));
  if (opts?.timestamps) u.searchParams.set("timestamps", "true");
  return fetchJson<MonthlyResponse>(u.toString());
}

export async function fetchRange(
  startDate: string,
  endDate: string,
  opts?: { timestamps?: boolean }
) {
  const u = new URL(`${API_BASE_URL}/analytics/range`);
  u.searchParams.set("startDate", startDate);
  u.searchParams.set("endDate", endDate);
  if (opts?.timestamps) u.searchParams.set("timestamps", "true");
  return fetchJson<RangeResponse>(u.toString());
}

export async function listCampaigns(opts?: {
  token?: string;
  status?: CampaignEffectiveStatus | "all";
  name?: string;
  createdFrom?: string;
  createdTo?: string;
  includeDeleted?: boolean;
  budgetMin?: number | string;
  budgetMax?: number | string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.status && opts.status !== "all") params.set("status", opts.status);
  if (opts?.name) params.set("name", opts.name);
  if (opts?.createdFrom) params.set("createdFrom", opts.createdFrom);
  if (opts?.createdTo) params.set("createdTo", opts.createdTo);
  if (opts?.includeDeleted) params.set("includeDeleted", "true");
  if (opts?.budgetMin !== undefined && opts.budgetMin !== "") params.set("budgetMin", String(opts.budgetMin));
  if (opts?.budgetMax !== undefined && opts.budgetMax !== "") params.set("budgetMax", String(opts.budgetMax));
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.limit) params.set("limit", String(opts.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchAuthJson<CampaignEnvelope<{ campaigns: Campaign[]; pagination: Pagination }>>(
    `/admin/campaigns${query}`,
    { token: opts?.token }
  );
}

export async function getCampaign(id: string, token?: string) {
  return fetchAuthJson<CampaignEnvelope<{ campaign: Campaign }>>(
    `/admin/campaigns/${id}`,
    { token }
  );
}

export async function listCampaignServices(token?: string) {
  return fetchAuthJson<CampaignEnvelope<{ services: CampaignService[] }>>(
    "/admin/campaigns/services",
    { token }
  );
}

export async function createCampaign(input: CreateCampaignInput, token?: string) {
  return fetchAuthJson<CampaignEnvelope<{ campaign: Campaign }>>("/admin/campaigns", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
  token?: string,
  opts?: { notify?: boolean }
) {
  const params = new URLSearchParams();
  if (opts?.notify === false) params.set("notify", "false");
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchAuthJson<CampaignEnvelope<{ campaign: Campaign }>>(
    `/admin/campaigns/${id}${query}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(input),
    }
  );
}

export async function getCampaignReport(id: string, token?: string) {
  return fetchAuthJson<CampaignEnvelope<CampaignReport>>(
    `/admin/campaigns/${id}/report`,
    { token }
  );
}

export async function listCampaignMembers(opts: {
  id: string;
  token?: string;
  status?: CampaignMember["status"] | "all";
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts.status && opts.status !== "all") params.set("status", opts.status);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchAuthJson<CampaignEnvelope<{ members: CampaignMember[]; pagination: Pagination }>>(
    `/admin/campaigns/${opts.id}/members${query}`,
    { token: opts.token }
  );
}

export async function listAdminTransactions(opts?: {
  token?: string;
  userId?: string;
  type?: "credit" | "debit" | "all";
  status?: "completed" | "failed" | "all";
  reference?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.userId) params.set("userId", opts.userId);
  if (opts?.type && opts.type !== "all") params.set("type", opts.type);
  if (opts?.status && opts.status !== "all") params.set("status", opts.status);
  if (opts?.reference) params.set("reference", opts.reference);
  if (opts?.createdFrom) params.set("createdFrom", opts.createdFrom);
  if (opts?.createdTo) params.set("createdTo", opts.createdTo);
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.limit) params.set("limit", String(opts.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchAuthJson<CampaignEnvelope<{ transactions: AdminTransaction[]; pagination: Pagination }>>(
    `/admin/transactions${query}`,
    { token: opts?.token }
  );
}

export async function listAdminUsers(opts?: {
  token?: string;
  search?: string;
  name?: string;
  role?: string;
  isAdmin?: boolean | "all";
  createdFrom?: string;
  createdTo?: string;
  hasBonus?: boolean | "all";
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.name) params.set("name", opts.name);
  if (opts?.role && opts.role !== "all") params.set("role", opts.role);
  if (opts?.isAdmin !== undefined && opts.isAdmin !== "all") params.set("isAdmin", String(opts.isAdmin));
  if (opts?.createdFrom) params.set("createdFrom", opts.createdFrom);
  if (opts?.createdTo) params.set("createdTo", opts.createdTo);
  if (opts?.hasBonus !== undefined && opts.hasBonus !== "all") params.set("hasBonus", String(opts.hasBonus));
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.limit) params.set("limit", String(opts.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchAuthJson<CampaignEnvelope<{ users: AdminUser[]; pagination: Pagination }>>(
    `/admin/users${query}`,
    { token: opts?.token }
  );
}

export async function selectAllAdminUsers(opts?: {
  token?: string;
  search?: string;
  name?: string;
  role?: string;
  isAdmin?: boolean | "all";
  createdFrom?: string;
  createdTo?: string;
  hasBonus?: boolean | "all";
}) {
  const params = new URLSearchParams();
  params.set("select", "all");
  if (opts?.search) params.set("search", opts.search);
  if (opts?.name) params.set("name", opts.name);
  if (opts?.role && opts.role !== "all") params.set("role", opts.role);
  if (opts?.isAdmin !== undefined && opts.isAdmin !== "all") params.set("isAdmin", String(opts.isAdmin));
  if (opts?.createdFrom) params.set("createdFrom", opts.createdFrom);
  if (opts?.createdTo) params.set("createdTo", opts.createdTo);
  if (opts?.hasBonus !== undefined && opts.hasBonus !== "all") params.set("hasBonus", String(opts.hasBonus));
  return fetchAuthJson<CampaignEnvelope<{ userIds: string[]; total: number }>>(
    `/admin/users?${params.toString()}`,
    { token: opts?.token }
  );
}

export async function deleteCampaign(id: string, opts?: { token?: string }) {
  return fetchAuthJson<CampaignEnvelope<{ campaign?: Campaign; forfeited?: { userId: string; amount?: number }[]; summary?: RevokeSummary }>>(
    `/admin/campaigns/${id}`,
    {
      method: "DELETE",
      token: opts?.token,
    }
  );
}

export async function bulkFundCampaignMembers(
  id: string,
  input: { members: FundMemberInput[]; amount?: number; notify?: boolean },
  token?: string
) {
  return fetchAuthJson<
    CampaignEnvelope<{
      summary?: FundingSummary;
      funded: { userId: string; amount: number }[];
      unmatched: { userId?: string; email?: string; reason: string }[];
    }>
  >(`/admin/campaigns/${id}/members`, {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function createCampaignFundJob(
  id: string,
  input: { amount: number; allUsers?: boolean; members?: FundMemberInput[]; role?: string; notify?: boolean },
  token?: string
) {
  return fetchAuthJson<CampaignEnvelope<{ job: FundJob }>>(`/admin/campaigns/${id}/fund-jobs`, {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function getCampaignFundJob(id: string, jobId: string, token?: string) {
  return fetchAuthJson<CampaignEnvelope<{ job: FundJob }>>(
    `/admin/campaigns/${id}/fund-jobs/${jobId}`,
    { token }
  );
}

export async function listCampaignFundJobs(id: string, token?: string) {
  return fetchAuthJson<CampaignEnvelope<{ jobs: FundJob[] }>>(
    `/admin/campaigns/${id}/fund-jobs`,
    { token }
  );
}

export async function revokeCampaignMembers(
  id: string,
  userIds: string[],
  token?: string
) {
  return fetchAuthJson<
    CampaignEnvelope<{
      summary?: RevokeSummary;
      revoked: { userId: string; reclaimed: number }[];
      notFound: string[];
    }>
  >(`/admin/campaigns/${id}/revoke`, {
    method: "POST",
    token,
    body: JSON.stringify({ userIds }),
  });
}

function normalizeUserBalance(data: UserBalanceResponseData): UserBalance {
  if ("currency" in data) {
    return data;
  }

  if (typeof data.balance === "object" && data.balance !== null) {
    return data.balance;
  }

  return {
    balance: 0,
    currency: "NGN",
    bonus: { balance: 0, items: [] },
    activeSource: "paid",
    autoBillWalletWhenBonusLow: false,
  };
}

export async function getUserBalance(token?: string): Promise<CampaignEnvelope<UserBalance>> {
  const response = await fetchAuthJson<CampaignEnvelope<UserBalanceResponseData>>("/user/balance", {
    token,
  });

  return {
    ...response,
    data: normalizeUserBalance(response.data),
  };
}

export async function setBillingConsent(
  autoBillWalletWhenBonusLow: boolean,
  token?: string
) {
  return fetchAuthJson<
    CampaignEnvelope<{ autoBillWalletWhenBonusLow: boolean }>
  >("/user/billing-consent", {
    method: "PATCH",
    token,
    body: JSON.stringify({ autoBillWalletWhenBonusLow }),
  });
}

export type Feedback = {
  id: string;
  userId?: string;
  user?: UserSummary | null;
  rating?: number | null;
  comment?: string | null;
  source: string;
  jobKind?: string | null;
  jobKinds?: string[];
  selections?: string[];
  updatedAt?: string;
  createdAt: string;
  deletedAt?: string | null;
  isDeleted?: boolean;
};
export type FeedbackFilters = {
  source?: string;
  ratingMin?: string;
  ratingMax?: string;
  hasComment?: string;
  jobKind?: string;
  createdFrom?: string;
  createdTo?: string;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
};
export type FeedbackStats = {
  totalFeedback: number;
  averageRating: number | null;
  bySource: { source: string; count: number }[];
};

function feedbackQuery(filters: FeedbackFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

// Keep response-envelope adaptation at the API boundary.
function feedbackData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error("Unexpected feedback response.");
  const body = value as Record<string, unknown>;
  return (body.data ?? body) as Record<string, unknown>;
}
export async function listFeedback(filters: FeedbackFilters, token: string, signal?: AbortSignal) {
  const body = feedbackData(await fetchAuthJson<unknown>(`/admin/feedback?${feedbackQuery(filters)}`, { token, signal }));
  const rows = body.feedback ?? body.feedbacks ?? body.items;
  const pagination = body.pagination as Pagination | undefined;
  if (!Array.isArray(rows) || !pagination || !Number.isFinite(pagination.total)) {
    throw new Error("Unexpected feedback response. Please try again.");
  }
  return {
    feedback: rows.map((row) => ({ ...row, id: row.id ?? row._id })) as Feedback[],
    pagination,
  };
}
export async function getFeedbackStats(filters: Pick<FeedbackFilters, "source" | "createdFrom" | "createdTo">, token: string, signal?: AbortSignal): Promise<FeedbackStats> {
  const body = feedbackData(await fetchAuthJson<unknown>(`/admin/feedback/stats?${feedbackQuery(filters)}`, { token, signal }));
  const stats = (body.stats ?? body) as Record<string, unknown>;
  const total = stats.totalFeedback ?? stats.total;
  const average = stats.averageRating ?? stats.avgRating;
  const counts = stats.bySource ?? stats.countsBySource;
  if (typeof total !== "number" || !counts || typeof counts !== "object") throw new Error("Unexpected feedback statistics response.");
  const bySource = Array.isArray(counts)
    ? counts.map((item) => ({ source: String(item.source ?? item._id), count: Number(item.count) }))
    : Object.entries(counts).map(([source, count]) => ({ source, count: Number(count) }));
  return { totalFeedback: total, averageRating: average == null ? null : Number(average), bySource };
}
export type FeedbackSource = { id: string; label: string };

export async function getFeedbackSources(token: string, signal?: AbortSignal): Promise<FeedbackSource[]> {
  const body = feedbackData(await fetchAuthJson<unknown>("/admin/feedback/sources", { token, signal }));
  const sources = Array.isArray(body) ? body : body.sources;
  if (!Array.isArray(sources) || !sources.every((source): source is FeedbackSource =>
    source !== null && typeof source === "object" &&
    typeof source.id === "string" && source.id.trim().length > 0 &&
    typeof source.label === "string" && source.label.trim().length > 0
  )) throw new Error("Unexpected feedback sources response.");
  return Array.from(new Map(sources.map((source) => [source.id, source])).values());
}
export async function deleteFeedback(id: string, token: string) {
  return fetchAuthJson<unknown>(`/admin/feedback/${encodeURIComponent(id)}`, { method: "DELETE", token });
}
