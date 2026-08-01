// types/analytics.ts
export type PeriodKey = "today" | "yesterday" | "thisWeek" | "thisMonth";

export interface TopPerformer {
  shortCode: string;
  clicks: number;
  jobTitle: string;
  location: string;
  originalUrl: string;
  firstClickAt?: string;
  lastClickAt?: string;
  timestamps?: string[];
}

export interface SummaryData {
  today: { clicks: number; uniqueUrls: number };
  yesterday: { clicks: number; uniqueUrls: number };
  thisWeek: {
    clicks: number;
    uniqueUrls: number;
    topPerformers: TopPerformer[];
  };
  thisMonth: {
    clicks: number;
    uniqueUrls: number;
    topPerformers: TopPerformer[];
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
