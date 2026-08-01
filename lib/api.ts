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
export type CampaignEffectiveStatus = CampaignStatus | "expired";

export type CampaignStats = {
  memberCount: number;
  totalGranted: number;
  totalRemaining: number;
  totalSpent: number;
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
    throw new Error("Could not reach the campaign service. Please try again.");
  }

  const body = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    code?: number;
  };

  if (!res.ok || (body.code && body.code >= 400)) {
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
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.status && opts.status !== "all") params.set("status", opts.status);
  if (opts?.name) params.set("name", opts.name);
  if (opts?.createdFrom) params.set("createdFrom", opts.createdFrom);
  if (opts?.createdTo) params.set("createdTo", opts.createdTo);
  if (opts?.includeDeleted) params.set("includeDeleted", "true");
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.limit) params.set("limit", String(opts.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchAuthJson<CampaignEnvelope<{ campaigns: Campaign[]; pagination: Pagination }>>(
    `/admin/campaigns${query}`,
    { token: opts?.token }
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
  token?: string
) {
  return fetchAuthJson<CampaignEnvelope<{ campaign: Campaign }>>(
    `/admin/campaigns/${id}`,
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
  return fetchAuthJson<CampaignEnvelope<{ transactions: WalletTransaction[]; pagination: Pagination }>>(
    `/admin/transactions${query}`,
    { token: opts?.token }
  );
}

export async function deleteCampaign(id: string, opts?: { token?: string; cascadeRevoke?: boolean }) {
  const query = opts?.cascadeRevoke ? "?cascadeRevoke=true" : "";
  return fetchAuthJson<CampaignEnvelope<{ campaign?: Campaign; reclaimed?: number }>>(
    `/admin/campaigns/${id}${query}`,
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
      funded: { userId: string; amount: number }[];
      unmatched: { userId?: string; email?: string; reason: string }[];
    }>
  >(`/admin/campaigns/${id}/members`, {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function revokeCampaignMembers(
  id: string,
  userIds: string[],
  token?: string
) {
  return fetchAuthJson<
    CampaignEnvelope<{
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
