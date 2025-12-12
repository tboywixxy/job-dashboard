// types/analytics.ts
export type PeriodKey = "today" | "yesterday" | "thisWeek" | "thisMonth";

export interface SummaryData {
  today: { clicks: number; uniqueUrls: number };
  yesterday: { clicks: number; uniqueUrls: number };
  thisWeek: {
    clicks: number;
    uniqueUrls: number;
    topPerformers: any[];
  };
  thisMonth: {
    clicks: number;
    uniqueUrls: number;
    topPerformers: any[];
    locationBreakdown: Record<string, number>;
    jobTitleBreakdown: Record<string, number>;
  };
}

export interface DailyPoint {
  date: string; // "2025-12-08"
  totalClicks: number;
}

export interface WeeklyData {
  totalClicks: number;
  uniqueUrls: number;
  dailyBreakdown: {
    date: string;
    totalClicks: number;
  }[];
}

export interface MonthlyData {
  totalClicks: number;
  uniqueUrls: number;
  dailyBreakdown: DailyPoint[];
}
