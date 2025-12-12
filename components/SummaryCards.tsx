// components/SummaryCards.tsx
"use client";

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

const cardOrder: { key: SelectedRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This Week" },
  { key: "thisMonth", label: "This Month" },
];

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  selectedRange,
  onSelectRange,
}) => {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cardOrder.map(({ key, label }) => {
        const stats = summary[key];
        const isActive = selectedRange === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectRange(key)}
            className={`rounded-xl border p-4 text-left transition ${
              isActive
                ? "border-indigo-500/80 bg-indigo-950/60 shadow-[0_0_0_1px_rgba(129,140,248,0.3)]"
                : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {label}
              </span>
              {isActive && (
                <span className="inline-flex h-2 w-2 items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              )}
            </div>

            <p className="text-2xl font-semibold text-slate-50">
              {stats.clicks.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400">
                clicks
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
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
