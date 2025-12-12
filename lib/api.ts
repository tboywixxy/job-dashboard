// lib/api.ts
const API_BASE_URL = "https://jobs.api.mastaskillz.com";

/* ------------------------------------------------------------------ */
/*                               TYPES                                */
/* ------------------------------------------------------------------ */

export type TopPerformer = {
  shortCode: string;
  clicks: number;
  jobTitle: string;
  location: string;
  originalUrl: string;
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

// Convenience type = just the inner data (what you usually store in state)
export type SummaryData = SummaryResponse["data"];

export type DailyBreakdown = {
  date: string; // e.g. "2025-12-08"
  totalClicks: number;
  uniqueUrls: number;
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

// Convenience type = inner weekly data only
export type WeeklyData = WeeklyResponse["data"];

// Monthly has the same shape as Weekly (per API docs/JSON)
export type MonthlyResponse = WeeklyResponse;
export type MonthlyData = MonthlyResponse["data"];

// /analytics/range has the same shape as Weekly as well
export type RangeResponse = WeeklyResponse;
export type RangeData = RangeResponse["data"];

export type TimeRange = "today" | "yesterday" | "thisWeek" | "thisMonth";

/* ------------------------------------------------------------------ */
/*                             FETCH HELPERS                          */
/* ------------------------------------------------------------------ */

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchSummary(): Promise<SummaryResponse> {
  return fetchJson<SummaryResponse>(`${API_BASE_URL}/analytics/summary`);
}

export async function fetchWeekly(): Promise<WeeklyResponse> {
  return fetchJson<WeeklyResponse>(`${API_BASE_URL}/analytics/weekly`);
}

export async function fetchMonthly(
  year: number,
  month: number
): Promise<MonthlyResponse> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month), // 1–12
  });
  return fetchJson<MonthlyResponse>(
    `${API_BASE_URL}/analytics/monthly?${params.toString()}`
  );
}

// 🔹 NEW: generic date range helper (startDate/endDate = "YYYY-MM-DD")
export async function fetchRange(
  startDate: string,
  endDate: string
): Promise<RangeResponse> {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });
  return fetchJson<RangeResponse>(
    `${API_BASE_URL}/analytics/range?${params.toString()}`
  );
}

/* ------------------------------------------------------------------ */
/*                        SUMMARY RANGE HELPERS                       */
/* ------------------------------------------------------------------ */

// Helpers to derive summary numbers for each time range
// 👀 NOTE: this expects you to pass summary *data* (i.e. response.data), not the full response
export function getSummaryForRange(
  summary: SummaryData | null,
  range: TimeRange
) {
  if (!summary) return { clicks: 0, uniqueUrls: 0 };

  const { today, yesterday, thisWeek, thisMonth } = summary;

  switch (range) {
    case "today":
      return today;
    case "yesterday":
      return yesterday;
    case "thisWeek":
      return thisWeek;
    case "thisMonth":
      return thisMonth;
  }
}

/* ------------------------------------------------------------------ */
/*                     BREAKDOWNS FOR TREND + CHARTS                  */
/* ------------------------------------------------------------------ */

// For charts & tables, we derive from weekly / monthly data
// 👀 weekly / monthly here are *data* (response.data), not the full response
export function getBreakdownsForRange(
  weekly: WeeklyData | null,
  monthly: MonthlyData | null,
  summary: SummaryData | null,
  range: TimeRange
) {
  // Default empty state
  let locationBreakdown: Record<string, number> = {};
  let jobTitleBreakdown: Record<string, number> = {};
  let topPerformers: TopPerformer[] = [];
  let trendData: { date: string; totalClicks: number }[] = [];

  const hasWeekly = !!weekly;
  const hasMonthly = !!monthly;

  // 🔹 Monthly range: use monthly endpoint if available
  if (range === "thisMonth" && hasMonthly) {
    const m = monthly!;

    trendData = m.dailyBreakdown.map((d) => ({
      date: d.date,
      totalClicks: d.totalClicks,
    }));

    locationBreakdown = m.locationBreakdown;
    jobTitleBreakdown = m.jobTitleBreakdown;
    topPerformers = m.topPerformers;
  }
  // 🔹 Default / weekly-based (today, yesterday, thisWeek)
  else if (hasWeekly) {
    const w = weekly!;

    trendData = w.dailyBreakdown.map((d) => ({
      date: d.date,
      totalClicks: d.totalClicks,
    }));

    locationBreakdown = w.locationBreakdown;
    jobTitleBreakdown = w.jobTitleBreakdown;
    topPerformers = w.topPerformers;

    // Today / Yesterday → drill into daily breakdown
    if (range === "today" || range === "yesterday") {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const targetDate =
        range === "today"
          ? today.toISOString().slice(0, 10)
          : yesterday.toISOString().slice(0, 10);

      const day = w.dailyBreakdown.find((d) => d.date === targetDate);

      if (day) {
        locationBreakdown = day.locationBreakdown;
        jobTitleBreakdown = day.jobTitleBreakdown;
        topPerformers = day.topShortCodes;
      }
    }
  }

  // Prefer summary's dedicated topPerformers if present
  if (summary) {
    if (range === "thisWeek" && summary.thisWeek.topPerformers) {
      topPerformers = summary.thisWeek.topPerformers;
    }
    if (range === "thisMonth" && summary.thisMonth.topPerformers) {
      topPerformers = summary.thisMonth.topPerformers;
    }
  }

  return {
    locationBreakdown,
    jobTitleBreakdown,
    topPerformers,
    trendData,
  };
}
