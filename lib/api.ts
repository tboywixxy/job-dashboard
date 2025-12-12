// lib/api.ts
const API_BASE_URL = "https://jobs.api.mastaskillz.com";

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

// Monthly has the same shape as Weekly (per API docs/JSON)
export type MonthlyResponse = WeeklyResponse;

// /analytics/range has the same shape as Weekly as well
export type RangeResponse = WeeklyResponse;

// Convenience: data-only types
export type SummaryData = SummaryResponse["data"];
export type WeeklyData = WeeklyResponse["data"];
export type MonthlyData = MonthlyResponse["data"];
export type RangeData = RangeResponse["data"];

export type TimeRange = "today" | "yesterday" | "thisWeek" | "thisMonth";

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

// Helpers to derive summary numbers for each time range
export function getSummaryForRange(
  summary: SummaryResponse | null,
  range: TimeRange
) {
  if (!summary) return { clicks: 0, uniqueUrls: 0 };

  const { today, yesterday, thisWeek, thisMonth } = summary.data;

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

// For charts & tables, we derive from weekly / monthly data
export function getBreakdownsForRange(
  weekly: WeeklyResponse | null,
  monthly: MonthlyResponse | null,
  summary: SummaryResponse | null,
  range: TimeRange
) {
  // Default empty state
  let locationBreakdown: Record<string, number> = {};
  let jobTitleBreakdown: Record<string, number> = {};
  let topPerformers: TopPerformer[] = [];
  let trendData: { date: string; totalClicks: number }[] = [];

  const hasWeekly = !!weekly && weekly.success;
  const hasMonthly = !!monthly && monthly.success;

  // 🔹 Monthly range: use monthly endpoint if available
  if (range === "thisMonth" && hasMonthly) {
    const m = monthly!.data;

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
    const w = weekly!.data;

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
    if (range === "thisWeek" && summary.data.thisWeek.topPerformers) {
      topPerformers = summary.data.thisWeek.topPerformers;
    }
    if (range === "thisMonth" && summary.data.thisMonth.topPerformers) {
      topPerformers = summary.data.thisMonth.topPerformers;
    }
  }

  return {
    locationBreakdown,
    jobTitleBreakdown,
    topPerformers,
    trendData,
  };
}

/* ------------------------------------------------------------------ */
/*                 NEW: week-vs-week comparison helpers               */
/* ------------------------------------------------------------------ */

// Format a Date to "YYYY-MM-DD"
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Get this-week and last-week ranges based on "today"
export function getThisWeekAndLastWeekRanges(today = new Date()) {
  // Simple rolling 7-day weeks:
  // thisWeek: today-6 ... today
  // lastWeek: today-13 ... today-7
  const currentEnd = new Date(today);
  const currentStart = new Date(today);
  currentStart.setDate(currentEnd.getDate() - 6);

  const prevEnd = new Date(currentStart);
  prevEnd.setDate(currentStart.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - 6);

  return {
    current: {
      startDate: formatDate(currentStart),
      endDate: formatDate(currentEnd),
    },
    previous: {
      startDate: formatDate(prevStart),
      endDate: formatDate(prevEnd),
    },
  };
}

// Fetch "this week" vs "last week" using /analytics/range
export async function fetchWeekComparison() {
  const { current, previous } = getThisWeekAndLastWeekRanges();

  const [currentRes, previousRes] = await Promise.all([
    fetchRange(current.startDate, current.endDate),
    fetchRange(previous.startDate, previous.endDate),
  ]);

  if (!currentRes.success || !previousRes.success) {
    throw new Error("Failed to fetch week comparison");
  }

  return {
    current: currentRes.data,
    previous: previousRes.data,
  };
}
