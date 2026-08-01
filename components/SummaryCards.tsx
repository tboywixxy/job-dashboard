// components/SummaryCards.tsx
"use client";

import {
  CalendarClock,
  CalendarDays,
  MousePointerClick,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

type SelectedRange = "today" | "yesterday" | "thisWeek" | "thisMonth";

type SummaryCardsProps = {
  summary: {
    today: { clicks: number; uniqueUrls: number };
    yesterday: { clicks: number; uniqueUrls: number };
    thisWeek: { clicks: number; uniqueUrls: number };
    thisMonth: { clicks: number; uniqueUrls: number };
  };
  selectedRange: SelectedRange;
  onSelectRange: (range: SelectedRange) => void;
};

const cardOrder: { key: SelectedRange; label: string; icon: LucideIcon }[] = [
  { key: "today", label: "Today", icon: MousePointerClick },
  { key: "yesterday", label: "Yesterday", icon: CalendarClock },
  { key: "thisWeek", label: "This Week", icon: TrendingUp },
  { key: "thisMonth", label: "This Month", icon: CalendarDays },
];

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  selectedRange,
  onSelectRange,
}) => {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cardOrder.map(({ key, label, icon: Icon }) => {
        const stats = summary[key];
        const isActive = selectedRange === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectRange(key)}
            className={`group rounded-xl border bg-white p-4 text-left shadow-sm transition ${
              isActive
                ? "border-[#48C05C] ring-4 ring-[#48C05C]/10"
                : "border-slate-200 hover:border-[#48C05C]/40 hover:shadow-md"
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </span>
              <span
                className={`grid h-9 w-9 place-items-center rounded-lg ${
                  isActive
                    ? "bg-[#48C05C] text-white"
                    : "bg-slate-100 text-slate-500 group-hover:bg-[#48C05C]/10 group-hover:text-[#48C05C]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>

            <p className="text-3xl font-semibold tracking-tight text-slate-950">
              {stats.clicks.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {stats.uniqueUrls.toLocaleString()} unique job URLs
            </p>
          </button>
        );
      })}
    </section>
  );
};

// keep default export for flexibility
export default SummaryCards;
